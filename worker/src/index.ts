import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { bodyLimit } from 'hono/body-limit';
import { HTTPException } from 'hono/http-exception';
import { getCookie } from 'hono/cookie';
import type { Context } from 'hono';
import { z } from 'zod';
import type { AppEnv, User } from './env';
import { isPlatformAdmin, toPublicUser } from './env';
import { dbAll, dbFirst, dbRun, newId, now } from './db';
import {
  SESSION_COOKIE,
  clearSessionCookie,
  createSession,
  deleteSession,
  hashPassword,
  requireAuth,
  requireOrg,
  requireRole,
  setSessionCookie,
  verifyPassword,
} from './auth';
import { getModel, publicModels } from './models';
import { streamChat } from './providers';
import { enforceRateLimit } from './rate-limit';
import { createApiKey, createPersonalWorkspace, getOrgContext, recordAudit } from './orgs';
import { streamOmni, providerHealth } from './omni';
import { OpScanner } from '../../src/protocol/scanner';
import { buildSystemPrompt, buildUserPrompt } from '../../src/protocol/prompt';
import { validateScript } from '../../src/protocol/validate';
import type { BoardState } from '../../src/protocol/types';
import admin from './admin';
import billing from './billing';
import manual from './manual';
import mcp from './mcp';
import { openapi } from './openapi';
import { adminHtml } from './admin-ui';
import { docsHtml } from './docs-ui';
import { b64urlToBytes, notifyUser, validateEndpoint } from './push';

const app = new Hono<AppEnv>();

app.use('*', logger());
app.use('*', async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set('requestId', requestId);
  c.header('x-request-id', requestId);
  c.header('x-content-type-options', 'nosniff');
  c.header('referrer-policy', 'no-referrer');
  c.header('x-frame-options', 'DENY');
  c.header('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  await next();
});
app.use('*', cors({
  origin: (origin, c) => {
    const allowed = (c.env.APP_ORIGIN || 'http://localhost:3000').split(',').map((s: string) => s.trim()).filter(Boolean);
    return allowed.includes(origin) ? origin : allowed[0];
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Api-Key', 'X-Org-Id', 'X-Platform-Token', 'Stripe-Signature'],
  exposeHeaders: ['x-request-id'],
  maxAge: 86400,
}));

const RegisterBody = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(200),
  name: z.string().trim().min(1).max(80).optional(),
});
const LoginBody = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
});
const ChatBody = z.object({
  model: z.string().min(1).max(120),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(20000),
  })).min(1).max(20),
  mode: z.enum(['lesson', 'continue']).optional(),
  board: z.object({
    atStep: z.number().int().min(0).max(1000),
    objects: z.array(z.any()).max(500),
  }).optional(),
  lang: z.string().max(20).optional(),
  maxTokens: z.number().int().min(256).max(8192).optional(),
  extended: z.boolean().optional(),
});
const LessonBody = z.object({
  title: z.string().trim().max(120).optional(),
  lang: z.string().max(20).optional(),
  script: z.any(),
});
const ApiKeyBody = z.object({
  name: z.string().trim().max(60).optional(),
  scopes: z.string().trim().max(120).optional(),
});
const PushSubBody = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
  userAgent: z.string().max(300).optional(),
});
const PushDeleteBody = z.object({ endpoint: z.string().url().max(2048) });

const parseBody = async <T>(c: Context<AppEnv>, schema: z.ZodType<T>): Promise<T> => {
  if (!(c.req.header('content-type') || '').toLowerCase().includes('application/json')) {
    throw new HTTPException(415, { message: 'Content-Type must be application/json' });
  }
  const raw = await c.req.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.path.join('.') + ': ' + i.message).join('; ');
    throw new HTTPException(400, { message });
  }
  return parsed.data;
};

const authBodyLimit = bodyLimit({ maxSize: 16 * 1024, onError: (c) => c.json({ error: 'payload too large' }, 413) });
const lessonBodyLimit = bodyLimit({ maxSize: 512 * 1024, onError: (c) => c.json({ error: 'payload too large' }, 413) });

const enforceQuota = async (db: D1Database, orgId: string, userId: string, kind: string, limit: number): Promise<void> => {
  if (!Number.isFinite(limit) || limit <= 0) return;
  const since = now() - 86_400_000;
  const row = await dbFirst<{ n: number }>(
    db,
    'SELECT COUNT(*) AS n FROM usage_events WHERE org_id = ? AND kind = ? AND created_at > ?',
    orgId,
    kind,
    since,
  );
  if ((row?.n ?? 0) >= limit) throw new HTTPException(429, { message: 'Daily limit reached' });
  await dbRun(
    db,
    'INSERT INTO usage_events (id, user_id, org_id, kind, amount, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    newId(),
    userId,
    orgId,
    kind,
    1,
    now(),
  );
};

const htmlResponse = (html: string): Response =>
  new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy':
        "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
    },
  });

app.post('/auth/register', authBodyLimit, async (c) => {
  await enforceRateLimit(c, 'register', Number(c.env.REGISTER_RATE_LIMIT || 10), 60 * 60 * 1000);
  const body = await parseBody(c, RegisterBody);
  const email = body.email.trim().toLowerCase();
  const existing = await dbFirst<{ id: string }>(c.env.DB, 'SELECT id FROM users WHERE email = ?', email);
  if (existing) throw new HTTPException(409, { message: 'Email already registered' });
  const { hash, salt } = await hashPassword(body.password);
  const id = newId();
  const createdAt = now();
  const name = body.name || email.split('@')[0];
  const adminFlag = isPlatformAdmin({ email, is_platform_admin: 0 }, c.env) ? 1 : 0;
  await dbRun(
    c.env.DB,
    'INSERT INTO users (id, email, name, password_hash, password_salt, created_at, is_platform_admin, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    id,
    email,
    name,
    hash,
    salt,
    createdAt,
    adminFlag,
    'active',
  );
  const user: User = { id, email, name, created_at: createdAt, is_platform_admin: adminFlag, status: 'active' };
  const workspace = await createPersonalWorkspace(c.env.DB, user);
  await recordAudit(c.env.DB, {
    orgId: workspace.org.id,
    actorId: user.id,
    action: 'auth.register',
    target: user.id,
    meta: { plan: workspace.plan.id },
    ip: c.req.header('cf-connecting-ip'),
  });
  const session = await createSession(c.env.DB, id, Number(c.env.SESSION_DAYS || 30));
  setSessionCookie(c, session.token, c.env);
  return c.json({ user: toPublicUser(user, c.env), org: workspace.org, plan: workspace.plan }, 201);
});

app.post('/auth/login', authBodyLimit, async (c) => {
  await enforceRateLimit(c, 'login', Number(c.env.AUTH_RATE_LIMIT || 60), 15 * 60 * 1000);
  const body = await parseBody(c, LoginBody);
  const email = body.email.trim().toLowerCase();
  const user = await dbFirst<User & { password_hash: string; password_salt: string }>(
    c.env.DB,
    'SELECT id, email, name, created_at, is_platform_admin, status, password_hash, password_salt FROM users WHERE email = ?',
    email,
  );
  if (!user || !(await verifyPassword(body.password, user.password_hash, user.password_salt))) {
    throw new HTTPException(401, { message: 'Invalid email or password' });
  }
  if ((user.status || 'active') !== 'active') throw new HTTPException(403, { message: 'Account suspended' });
  const session = await createSession(c.env.DB, user.id, Number(c.env.SESSION_DAYS || 30));
  setSessionCookie(c, session.token, c.env);
  let ctx = await getOrgContext(c.env.DB, user.id);
  if (!ctx) ctx = await createPersonalWorkspace(c.env.DB, user);
  await recordAudit(c.env.DB, {
    orgId: ctx.org.id,
    actorId: user.id,
    action: 'auth.login',
    target: user.id,
    ip: c.req.header('cf-connecting-ip'),
  });
  return c.json({ user: toPublicUser(user, c.env), org: ctx.org, plan: ctx.plan });
});

app.post('/auth/logout', async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await deleteSession(c.env.DB, token);
  clearSessionCookie(c, c.env);
  return c.json({ ok: true });
});

app.get('/auth/me', requireAuth, requireOrg, (c) =>
  c.json({
    user: toPublicUser(c.get('user'), c.env),
    org: c.get('org'),
    plan: c.get('plan'),
    subscription: c.get('subscription'),
    authKind: c.get('authKind'),
  }),
);

app.get('/v1/lessons', requireAuth, requireOrg, async (c) => {
  const org = c.get('org')!;
  const rows = await dbAll<{ id: string; title: string; lang: string; updated_at: number }>(
    c.env.DB,
    'SELECT id, title, lang, updated_at FROM lessons WHERE org_id = ? ORDER BY updated_at DESC LIMIT 100',
    org.id,
  );
  return c.json({ lessons: rows });
});

app.post('/v1/lessons', requireAuth, requireOrg, lessonBodyLimit, async (c) => {
  const user = c.get('user');
  const org = c.get('org')!;
  const plan = c.get('plan')!;
  if (plan.maxLessons >= 0) {
    const count = await dbFirst<{ n: number }>(c.env.DB, 'SELECT COUNT(*) AS n FROM lessons WHERE org_id = ?', org.id);
    if ((count?.n || 0) >= plan.maxLessons) {
      return c.json({ error: `The ${plan.name} plan allows ${plan.maxLessons} saved lessons`, upgrade: true }, 402);
    }
  }
  const body = await parseBody(c, LessonBody);
  const errors = validateScript(body.script, { extended: true });
  if (errors.length) throw new HTTPException(400, { message: errors.slice(0, 5).join('; ') });
  const id = newId();
  const ts = now();
  const script = body.script as { title?: string; lang?: string };
  const title = body.title || script?.title || 'Untitled lesson';
  const lang = body.lang || script?.lang || 'ar';
  await dbRun(
    c.env.DB,
    'INSERT INTO lessons (id, user_id, org_id, title, lang, script_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    id,
    user.id,
    org.id,
    title,
    lang,
    JSON.stringify(body.script),
    ts,
    ts,
  );
  await recordAudit(c.env.DB, {
    orgId: org.id,
    actorId: user.id,
    action: 'lesson.create',
    target: id,
    meta: { title, lang },
  });
  return c.json({ lesson: { id, title, lang, updatedAt: ts } }, 201);
});

app.get('/v1/lessons/:id', requireAuth, requireOrg, async (c) => {
  const org = c.get('org')!;
  const row = await dbFirst<{
    id: string; title: string; lang: string; script_json: string; created_at: number; updated_at: number;
  }>(
    c.env.DB,
    'SELECT id, title, lang, script_json, created_at, updated_at FROM lessons WHERE id = ? AND org_id = ?',
    c.req.param('id'),
    org.id,
  );
  if (!row) throw new HTTPException(404, { message: 'Lesson not found' });
  let script: unknown = {};
  try { script = JSON.parse(row.script_json); } catch { /* keep empty */ }
  return c.json({
    lesson: {
      id: row.id,
      title: row.title,
      lang: row.lang,
      script,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  });
});

app.put('/v1/lessons/:id', requireAuth, requireOrg, lessonBodyLimit, async (c) => {
  const org = c.get('org')!;
  const body = await parseBody(c, LessonBody.partial());
  const id = c.req.param('id');
  const existing = await dbFirst<{ id: string }>(c.env.DB, 'SELECT id FROM lessons WHERE id = ? AND org_id = ?', id, org.id);
  if (!existing) throw new HTTPException(404, { message: 'Lesson not found' });
  const updates: string[] = [];
  const values: (string | number)[] = [];
  if (body.title !== undefined) { updates.push('title = ?'); values.push(body.title); }
  if (body.lang !== undefined) { updates.push('lang = ?'); values.push(body.lang); }
  if (body.script !== undefined) {
    const errors = validateScript(body.script, { extended: true });
    if (errors.length) throw new HTTPException(400, { message: errors.slice(0, 5).join('; ') });
    updates.push('script_json = ?');
    values.push(JSON.stringify(body.script));
  }
  if (!updates.length) return c.json({ ok: true });
  updates.push('updated_at = ?');
  values.push(now(), id, org.id);
  await dbRun(c.env.DB, 'UPDATE lessons SET ' + updates.join(', ') + ' WHERE id = ? AND org_id = ?', ...values);
  return c.json({ ok: true });
});

app.delete('/v1/lessons/:id', requireAuth, requireOrg, async (c) => {
  const org = c.get('org')!;
  await dbRun(c.env.DB, 'DELETE FROM lessons WHERE id = ? AND org_id = ?', c.req.param('id'), org.id);
  return c.json({ ok: true });
});

app.get('/v1/push/public-key', (c) =>
  c.json({ publicKey: c.env.VAPID_PUBLIC_KEY || null, configured: Boolean(c.env.VAPID_PUBLIC_KEY && c.env.VAPID_PRIVATE_KEY) }),
);

app.post('/v1/push/subscribe', requireAuth, requireOrg, authBodyLimit, async (c) => {
  const body = await parseBody(c, PushSubBody);
  try {
    validateEndpoint(body.endpoint);
    if (b64urlToBytes(body.keys.p256dh).length !== 65) throw new Error('invalid p256dh key');
    if (b64urlToBytes(body.keys.auth).length !== 16) throw new Error('invalid auth secret');
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'invalid subscription' }, 400);
  }
  const org = c.get('org')!;
  const user = c.get('user')!;
  await dbRun(
    c.env.DB,
    `INSERT INTO push_subscriptions (id, org_id, user_id, endpoint, p256dh, auth, user_agent, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET
       org_id = excluded.org_id, user_id = excluded.user_id, p256dh = excluded.p256dh,
       auth = excluded.auth, user_agent = excluded.user_agent, last_seen_at = excluded.last_seen_at,
       revoked_at = NULL`,
    newId(),
    org.id,
    user.id,
    body.endpoint,
    body.keys.p256dh,
    body.keys.auth,
    body.userAgent || null,
    now(),
    now(),
  );
  return c.json({ ok: true });
});

app.delete('/v1/push/subscribe', requireAuth, requireOrg, authBodyLimit, async (c) => {
  const body = await parseBody(c, PushDeleteBody);
  await dbRun(
    c.env.DB,
    'UPDATE push_subscriptions SET revoked_at = ? WHERE endpoint = ? AND user_id = ?',
    now(),
    body.endpoint,
    c.get('user')!.id,
  );
  return c.json({ ok: true });
});

app.post('/v1/push/test', requireAuth, requireOrg, async (c) => {
  if (!c.env.VAPID_PUBLIC_KEY || !c.env.VAPID_PRIVATE_KEY) {
    return c.json({ error: 'push is not configured' }, 503);
  }
  const result = await notifyUser(c.env, c.get('org')!.id, c.get('user')!.id, {
    title: 'SmartBoard AI',
    body: 'Push notifications are working. Your class updates will appear here.',
    url: '/',
    tag: 'smartboard-test',
  });
  return c.json({ ok: true, ...result });
});

app.get('/v1/api-keys', requireAuth, requireOrg, async (c) => {
  const rows = await dbAll(
    c.env.DB,
    'SELECT id, name, prefix, scopes, created_at, last_used_at, revoked_at FROM api_keys WHERE org_id = ? ORDER BY created_at DESC',
    c.get('org')!.id,
  );
  return c.json({ apiKeys: rows });
});

app.post('/v1/api-keys', requireAuth, requireOrg, requireRole('owner', 'admin'), authBodyLimit, async (c) => {
  const org = c.get('org')!;
  const plan = c.get('plan')!;
  const body = await parseBody(c, ApiKeyBody);
  const count = await dbFirst<{ n: number }>(
    c.env.DB,
    'SELECT COUNT(*) AS n FROM api_keys WHERE org_id = ? AND revoked_at IS NULL',
    org.id,
  );
  if ((count?.n || 0) >= plan.maxApiKeys) {
    return c.json({ error: `The ${plan.name} plan allows ${plan.maxApiKeys} API keys`, upgrade: true }, 402);
  }
  const created = await createApiKey(c.env.DB, {
    orgId: org.id,
    userId: c.get('user').id,
    name: body.name || 'Default key',
    scopes: body.scopes || 'read,write',
  });
  await recordAudit(c.env.DB, {
    orgId: org.id,
    actorId: c.get('user').id,
    action: 'api_key.create',
    target: created.record.id,
    meta: { name: created.record.name, scopes: created.record.scopes },
  });
  return c.json({ key: created.raw, apiKey: created.record }, 201);
});

app.delete('/v1/api-keys/:id', requireAuth, requireOrg, requireRole('owner', 'admin'), async (c) => {
  await dbRun(
    c.env.DB,
    'UPDATE api_keys SET revoked_at = ? WHERE id = ? AND org_id = ?',
    now(),
    c.req.param('id'),
    c.get('org')!.id,
  );
  return c.json({ ok: true });
});

app.post(
  '/v1/chat/stream',
  requireAuth,
  requireOrg,
  bodyLimit({ maxSize: 256 * 1024, onError: (c) => c.json({ error: 'payload too large' }, 413) }),
  async (c) => {
    const user = c.get('user');
    const org = c.get('org')!;
    const plan = c.get('plan')!;
    const body = await parseBody(c, ChatBody);
    const model = getModel(body.model);
    if (!model) throw new HTTPException(400, { message: 'Unknown model' });
    if (!model.capabilities.streaming) throw new HTTPException(400, { message: 'Model does not support streaming' });
    if (model.provider !== 'omni' && model.keyEnv && !c.env[model.keyEnv]) {
      throw new HTTPException(503, { message: 'Model key is not configured: ' + model.keyEnv });
    }
    const limit = Number(c.env.DAILY_CHAT_LIMIT || plan.dailyChats);
    await enforceQuota(c.env.DB, org.id, user.id, 'chat', limit);

    const lastUser = [...body.messages].reverse().find((m) => m.role === 'user');
    const question = lastUser?.content || '';
    const system = buildSystemPrompt({ extended: body.extended ?? true, lang: body.lang });
    const userPrompt = buildUserPrompt({
      question,
      mode: body.mode,
      board: body.board as BoardState | undefined,
      lang: body.lang,
    });
    const messages = [{ role: 'user' as const, content: userPrompt }];
    const requestId = c.get('requestId') || crypto.randomUUID();
    c.header('x-request-id', requestId);
    const ac = new AbortController();
    c.req.raw.signal.addEventListener('abort', () => ac.abort());

    const encoder = new TextEncoder();
    const scanner = new OpScanner({ extended: true });
    let ops = 0;
    let steps = 0;
    let usedProvider = model.provider;
    let usedModel = model.id;
    const startedAt = Date.now();
    let streamStatus = 'ok';
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode('event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n'));
        };
        send('meta', { requestId, model: model.id, plan: plan.id });
        try {
          const source = model.provider === 'omni'
            ? streamOmni({
                planId: plan.id,
                system,
                messages,
                maxTokens: body.maxTokens ?? 6000,
                env: c.env,
                signal: ac.signal,
                onProvider: (m) => {
                  usedProvider = m.provider;
                  usedModel = m.id;
                  send('provider', { provider: m.provider, model: m.id });
                },
              })
            : streamChat({
                model,
                system,
                messages,
                maxTokens: body.maxTokens ?? 6000,
                env: c.env,
                signal: ac.signal,
              });
          for await (const delta of source) {
            send('delta', { text: delta });
            const result = scanner.feed(delta);
            for (const op of result.ops) {
              ops++;
              send('op', { op });
            }
            steps += result.completedSteps;
            if (result.completedSteps) send('step', { count: steps });
            if (result.errors.length) send('warning', { errors: result.errors });
          }
          send('done', { requestId, chars: scanner.text.length, ops, steps, provider: usedProvider, model: usedModel });
        } catch (err) {
          streamStatus = 'error';
          const message = err instanceof Error ? err.message : 'stream failed';
          console.error('chat stream failed', { requestId, model: model.id, message });
          send('error', { requestId, message });
        } finally {
          await dbRun(
            c.env.DB,
            `INSERT INTO runs (id, user_id, org_id, lesson_id, provider, model, status, latency_ms, prompt_tokens, completion_tokens, cost_usd, created_at)
             VALUES (?, ?, ?, NULL, ?, ?, ?, ?, NULL, NULL, NULL, ?)`,
            newId(),
            user.id,
            org.id,
            usedProvider,
            usedModel,
            streamStatus,
            Date.now() - startedAt,
            now(),
          ).catch(() => undefined);
          controller.close();
        }
      },
      cancel() { ac.abort(); },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  },
);

app.route('/v1/billing', billing);
app.route('/v1/billing', manual);
app.route('/v1/admin', admin);
app.route('/mcp', mcp);

app.get('/v1/openapi.json', (c) => c.json(openapi));
app.get('/openapi.json', (c) => c.json(openapi));
app.get('/admin', () => htmlResponse(adminHtml));
app.get('/admin/', () => htmlResponse(adminHtml));
app.get('/docs', () => htmlResponse(docsHtml));
app.get('/docs/', () => htmlResponse(docsHtml));

app.get('/', (c) => c.json({
  name: 'SmartBoard API',
  version: '1.0.0',
  docs: '/docs',
  admin: '/admin',
  mcp: '/mcp',
  openapi: '/v1/openapi.json',
}));

app.get('/health', async (c) => {
  try {
    await dbFirst(c.env.DB, 'SELECT 1 AS ok');
    return c.json({ ok: true, db: true, ts: now(), version: '1.0.0' });
  } catch {
    return c.json({ ok: false, db: false, ts: now(), version: '1.0.0' }, 503);
  }
});

app.get('/v1/models', (c) => c.json({ models: publicModels(), providers: providerHealth(c.env) }));
app.get('/v1/providers', (c) => c.json({ providers: providerHealth(c.env) }));

app.onError((err, c) => {
  const requestId = c.get('requestId') || c.header('x-request-id') || crypto.randomUUID();
  if (err instanceof HTTPException) {
    return c.json({ error: err.message, requestId }, err.status);
  }
  console.error('unhandled error', { requestId, message: err.message, stack: err.stack });
  return c.json({ error: 'internal error', requestId }, 500);
});

export default app;
