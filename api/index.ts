import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import type { MiddlewareHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';
import { BoardDoc } from '../shared/board/model';
import { ORG_KINDS, ROLES, can, type Action } from '../shared/auth/roles';
import { createPool } from '../db/client';
import type { OrgContext } from '../db/scoped';
import {
  addMember,
  createBoard,
  createLibraryItem,
  createOrg,
  createProject,
  deleteBoard,
  deleteLibraryItem,
  deleteProject,
  ensureWorkspace,
  getBoard,
  getMembership,
  getProject,
  healthCheck,
  listAudit,
  listBoards,
  listLibrary,
  listMembers,
  listOrgs,
  listProjects,
  removeMember,
  resolveUserId,
  updateBoard,
  updateMemberRole,
  updateProject,
  RepoError,
} from '../db/repo';
import type { AppEnv } from './env';
import { requireAuth } from './auth';
import { ALLOWED_UPLOADS, MAX_UPLOAD_BYTES, S3Storage } from './storage';
import { createRealtime, rawSql } from '@neon/realtime/server';

const app = new Hono<AppEnv>();

const MAX_JSON_BYTES = 2 * 1024 * 1024;

app.use('*', async (c, next) => {
  const requestId = randomUUID();
  c.set('requestId', requestId);
  c.header('x-request-id', requestId);
  c.header('x-content-type-options', 'nosniff');
  c.header('x-frame-options', 'DENY');
  c.header('referrer-policy', 'no-referrer');
  c.header('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  c.header('strict-transport-security', 'max-age=31536000; includeSubDomains');
  await next();
});

app.use('*', async (c, next) => {
  const db = createPool(c.env.DATABASE_URL);
  c.set('pool', db);
  try {
    await next();
  } finally {
    try {
      c.executionCtx.waitUntil(db.end());
    } catch {
      void db.end();
    }
  }
});

app.use('*', cors({
  origin: (origin, c) => {
    const env = c.env as AppEnv['Bindings'];
    const allowed: string[] = (env.APP_ORIGIN ?? 'http://localhost:3000,http://127.0.0.1:3000')
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);
    return allowed.includes(origin) ? origin : undefined;
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['x-request-id'],
  maxAge: 86400,
}));

const pool = (c: Context<AppEnv>) => c.get('pool');

app.use('/api/*', async (c, next) => {
  limit(c, 'api', 240, 60_000);
  await next();
});

const rateBuckets = new Map<string, { count: number; reset: number }>();

/** Best-effort per-isolate limiter. Cloudflare WAF/rate rules are the real edge. */
function limit(c: { req: { header: (n: string) => string | undefined } }, bucket: string, max: number, windowMs: number): void {
  const ip = c.req.header('cf-connecting-ip') ?? 'local';
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const entry = rateBuckets.get(key);
  if (!entry || entry.reset < now) {
    rateBuckets.set(key, { count: 1, reset: now + windowMs });
    return;
  }
  entry.count += 1;
  if (entry.count > max) throw new HTTPException(429, { message: 'too many requests' });
}

async function jsonBody<T>(c: { req: { header: (n: string) => string | undefined; json: () => Promise<unknown> } }, schema: z.ZodType<T>): Promise<T> {
  const declared = Number(c.req.header('content-length') ?? 0);
  if (declared > MAX_JSON_BYTES) throw new HTTPException(413, { message: 'payload too large' });
  const raw = await c.req.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new HTTPException(400, {
      message: parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '),
    });
  }
  return parsed.data;
}

const withOrgContext: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get('user');
  const orgId = c.req.param('orgId') ?? '';
  const role = await getMembership(pool(c), user.id, orgId);
  if (!role) throw new HTTPException(403, { message: 'not a member of this organisation' });
  c.set('org', { orgId, userId: user.id, role });
  await next();
};

function permit(action: Action): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const org = c.get('org');
    if (!can(org.role, action)) throw new HTTPException(403, { message: `requires ${action}` });
    await next();
  };
}

const OrgCreate = z.object({ name: z.string().trim().min(1).max(120), kind: z.enum(ORG_KINDS) });
const MemberAdd = z.object({ email: z.string().trim().toLowerCase().email().max(254), role: z.enum(ROLES) });
const MemberRole = z.object({ role: z.enum(ROLES) });
const ProjectCreate = z.object({ title: z.string().trim().min(1).max(200), description: z.string().max(2000).default('') });
const ProjectUpdate = z.object({ title: z.string().trim().min(1).max(200).optional(), description: z.string().max(2000).optional() });
const BoardCreate = z.object({ projectId: z.string().uuid(), title: z.string().trim().min(1).max(200), doc: BoardDoc });
const BoardUpdate = z.object({ title: z.string().trim().min(1).max(200).optional(), doc: BoardDoc.optional() }).refine(
  (v) => v.title !== undefined || v.doc !== undefined,
  { message: 'title or doc is required' },
);
const LibraryCreate = z.object({
  title: z.string().trim().min(1).max(200),
  kind: z.enum(['board', 'template']).default('board'),
  payload: BoardDoc,
  boardId: z.string().uuid().nullish(),
});

app.get('/health', async (c) => {
  try {
    const ok = await healthCheck(pool(c));
    return c.json({ ok, db: ok, time: new Date().toISOString() }, ok ? 200 : 503);
  } catch {
    return c.json({ ok: false, db: false, time: new Date().toISOString() }, 503);
  }
});

app.get('/api/health', async (c) => {
  try {
    const ok = await healthCheck(pool(c));
    return c.json({ ok, db: ok, time: new Date().toISOString() }, ok ? 200 : 503);
  } catch {
    return c.json({ ok: false, db: false, time: new Date().toISOString() }, 503);
  }
});

app.get('/api/me', requireAuth, async (c) => {
  const user = c.get('user');
  const orgs = await ensureWorkspace(pool(c), user);
  return c.json({ user: { id: user.id, email: user.email, name: user.name }, orgs });
});

app.post('/api/orgs', requireAuth, async (c) => {
  limit(c, 'org-create', 10, 60_000);
  const body = await jsonBody(c, OrgCreate);
  const org = await createOrg(pool(c), c.get('user'), body);
  return c.json({ org }, 201);
});

app.use('/api/orgs/:orgId/*', requireAuth, withOrgContext);

app.get('/api/orgs/:orgId', async (c) => {
  const org = c.get('org');
  const all = await listOrgs(pool(c), org.userId);
  const found = all.find((o) => o.id === org.orgId);
  if (!found) throw new HTTPException(404, { message: 'organisation not found' });
  return c.json({ org: found });
});

app.get('/api/orgs/:orgId/members', async (c) => c.json({ members: await listMembers(pool(c), c.get('org')) }));

app.post('/api/orgs/:orgId/members', permit('members.manage'), async (c) => {
  const body = await jsonBody(c, MemberAdd);
  const ctx = c.get('org');
  const userId = await resolveUserId(pool(c), ctx, body.email);
  if (!userId) throw new HTTPException(404, { message: 'no account with this email; ask them to sign up first' });
  const member = await addMember(pool(c), ctx, { userId, email: body.email, role: body.role });
  return c.json({ member }, 201);
});

app.patch('/api/orgs/:orgId/members/:memberId', permit('members.manage'), async (c) => {
  const body = await jsonBody(c, MemberRole);
  const member = await updateMemberRole(pool(c), c.get('org'), c.req.param('memberId'), body.role);
  return c.json({ member });
});

app.delete('/api/orgs/:orgId/members/:memberId', permit('members.manage'), async (c) =>
  c.json(await removeMember(pool(c), c.get('org'), c.req.param('memberId'))),
);

app.get('/api/orgs/:orgId/audit', permit('audit.read'), async (c) =>
  c.json({ entries: await listAudit(pool(c), c.get('org')) }),
);

app.get('/api/orgs/:orgId/projects', async (c) => c.json({ projects: await listProjects(pool(c), c.get('org')) }));

app.post('/api/orgs/:orgId/projects', permit('project.write'), async (c) => {
  const body = await jsonBody(c, ProjectCreate);
  return c.json({ project: await createProject(pool(c), c.get('org'), body) }, 201);
});

app.get('/api/orgs/:orgId/projects/:projectId', async (c) => {
  const project = await getProject(pool(c), c.get('org'), c.req.param('projectId'));
  if (!project) throw new HTTPException(404, { message: 'project not found' });
  return c.json({ project });
});

app.patch('/api/orgs/:orgId/projects/:projectId', permit('project.write'), async (c) => {
  const body = await jsonBody(c, ProjectUpdate);
  return c.json({ project: await updateProject(pool(c), c.get('org'), c.req.param('projectId'), body) });
});

app.delete('/api/orgs/:orgId/projects/:projectId', permit('project.delete'), async (c) =>
  c.json(await deleteProject(pool(c), c.get('org'), c.req.param('projectId'))),
);

app.get('/api/orgs/:orgId/projects/:projectId/boards', async (c) =>
  c.json({ boards: await listBoards(pool(c), c.get('org'), c.req.param('projectId')) }),
);

app.post('/api/orgs/:orgId/boards', permit('project.write'), async (c) => {
  const body = await jsonBody(c, BoardCreate);
  return c.json({ board: await createBoard(pool(c), c.get('org'), body) }, 201);
});

app.get('/api/orgs/:orgId/boards/:boardId', async (c) => {
  const board = await getBoard(pool(c), c.get('org'), c.req.param('boardId'));
  if (!board) throw new HTTPException(404, { message: 'board not found' });
  return c.json({ board });
});

app.patch('/api/orgs/:orgId/boards/:boardId', permit('board.write'), async (c) => {
  const body = await jsonBody(c, BoardUpdate);
  return c.json({ board: await updateBoard(pool(c), c.get('org'), c.req.param('boardId'), body) });
});

app.delete('/api/orgs/:orgId/boards/:boardId', permit('board.delete'), async (c) =>
  c.json(await deleteBoard(pool(c), c.get('org'), c.req.param('boardId'))),
);

app.get('/api/orgs/:orgId/library', async (c) => c.json({ items: await listLibrary(pool(c), c.get('org')) }));

app.post('/api/orgs/:orgId/library', permit('library.write'), async (c) => {
  const body = await jsonBody(c, LibraryCreate);
  return c.json({ item: await createLibraryItem(pool(c), c.get('org'), body) }, 201);
});

app.delete('/api/orgs/:orgId/library/:itemId', permit('library.write'), async (c) =>
  c.json(await deleteLibraryItem(pool(c), c.get('org'), c.req.param('itemId'))),
);

app.post('/api/orgs/:orgId/boards/:boardId/live', permit('board.read'), async (c) => {
  const org = c.get('org');
  const boardId = c.req.param('boardId');
  const board = await getBoard(pool(c), org, boardId);
  if (!board) throw new HTTPException(404, { message: 'board not found' });
  const dbName = c.env.NEON_REALTIME_DB ?? new URL(c.env.DATABASE_URL).pathname.replace(/^\//, '') ?? 'neondb';
  const realtime = createRealtime({ secret: c.env.NEON_REALTIME_SECRET, db: dbName || 'neondb' });
  const sealed = await realtime.seal({
    query: rawSql('select id, title, doc, updated_at from public.board_live where id = $1 and org_id = $2', [
      boardId,
      org.orgId,
    ]),
  });
  return c.json({ sealed });
});

app.post('/api/orgs/:orgId/uploads', permit('storage.write'), async (c) => {
  limit(c, 'upload', 30, 60_000);
  const org = c.get('org');
  const contentType = (c.req.header('content-type') ?? '').split(';')[0]?.trim() ?? '';
  const ext = ALLOWED_UPLOADS[contentType];
  if (!ext) throw new HTTPException(415, { message: 'unsupported content type' });
  const body = await c.req.arrayBuffer();
  if (body.byteLength === 0) throw new HTTPException(400, { message: 'empty upload' });
  if (body.byteLength > MAX_UPLOAD_BYTES) throw new HTTPException(413, { message: 'upload too large' });
  const key = `${org.orgId}/${randomUUID()}.${ext}`;
  const storage = new S3Storage({
    accessKeyId: c.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: c.env.AWS_SECRET_ACCESS_KEY,
    endpoint: c.env.AWS_ENDPOINT_URL_S3,
    region: c.env.AWS_REGION,
  });
  await storage.put(key, body, contentType);
  return c.json({ key, url: `/api/orgs/${org.orgId}/files?key=${encodeURIComponent(key)}` }, 201);
});

app.get('/api/orgs/:orgId/files', async (c) => {
  const org = c.get('org');
  const key = c.req.query('key') ?? '';
  if (!key.startsWith(`${org.orgId}/`)) throw new HTTPException(403, { message: 'key outside organisation' });
  const storage = new S3Storage({
    accessKeyId: c.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: c.env.AWS_SECRET_ACCESS_KEY,
    endpoint: c.env.AWS_ENDPOINT_URL_S3,
    region: c.env.AWS_REGION,
  });
  const object = await storage.get(key);
  if (!object) throw new HTTPException(404, { message: 'file not found' });
  return new Response(object.body, {
    headers: { 'content-type': object.contentType, 'cache-control': 'private, max-age=3600' },
  });
});

app.notFound((c) => c.json({ error: { code: 'not_found', message: 'route not found', requestId: c.get('requestId') } }, 404));

app.onError((error, c) => {
  const requestId = c.get('requestId') ?? '';
  if (error instanceof HTTPException) {
    return c.json({ error: { code: 'http_error', message: error.message, requestId } }, error.status as ContentfulStatusCode);
  }
  if (error instanceof RepoError) {
    return c.json({ error: { code: error.code, message: error.message, requestId } }, error.status as ContentfulStatusCode);
  }
  if (error instanceof z.ZodError) {
    return c.json({ error: { code: 'validation_error', message: 'invalid input', requestId } }, 400);
  }
  console.error('api_error', requestId, error instanceof Error ? error.message : 'unknown');
  return c.json({ error: { code: 'internal_error', message: 'internal error', requestId } }, 500);
});

export default app;
export type { OrgContext };
