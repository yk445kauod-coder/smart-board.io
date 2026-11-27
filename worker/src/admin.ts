import { Hono } from 'hono';
import type { AppEnv } from './env';
import { requireAuth, requirePlatformAdmin } from './auth';
import { dbAll, dbFirst, dbRun, now } from './db';
import { PLANS, publicPlans, type PlanId } from './plans';
import { recordAudit } from './orgs';
import { providerHealth } from './omni';
import { approvePaymentRequest, createActivationCode } from './manual';

const admin = new Hono<AppEnv>();

admin.use('*', requireAuth, requirePlatformAdmin);

const num = (value: unknown): number => (typeof value === 'number' ? value : Number(value) || 0);

admin.get('/overview', async (c) => {
  const db = c.env.DB;
  const since7 = now() - 7 * 86_400_000;
  const since1 = now() - 86_400_000;
  const [users, orgs, paidSubs, lessons, chatsToday, newUsers, mrr, audit] = await Promise.all([
    dbFirst<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM users'),
    dbFirst<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM organizations'),
    dbFirst<{ n: number }>(db, "SELECT COUNT(*) AS n FROM subscriptions WHERE plan <> 'free' AND status IN ('active','trialing')"),
    dbFirst<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM lessons'),
    dbFirst<{ n: number }>(db, "SELECT COUNT(*) AS n FROM usage_events WHERE kind = 'chat' AND created_at > ?", since1),
    dbFirst<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM users WHERE created_at > ?', since7),
    dbFirst<{ mrr: number }>(
      db,
      `SELECT COALESCE(SUM(CASE plan WHEN 'pro' THEN 299 WHEN 'school' THEN 1499 * seats WHEN 'enterprise' THEN 0 ELSE 0 END), 0) AS mrr
         FROM subscriptions WHERE status IN ('active','trialing')`,
    ),
    dbAll<{ id: string; action: string; target: string; created_at: number; actor_email: string | null }>(
      db,
      `SELECT a.id, a.action, a.target, a.created_at, u.email AS actor_email
         FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
        ORDER BY a.created_at DESC LIMIT 12`,
    ),
  ]);

  return c.json({
    overview: {
      users: num(users?.n),
      orgs: num(orgs?.n),
      paidSubscriptions: num(paidSubs?.n),
      lessons: num(lessons?.n),
      chatsToday: num(chatsToday?.n),
      newUsers7d: num(newUsers?.n),
      mrrEgp: num(mrr?.mrr),
      arrEgp: num(mrr?.mrr) * 12,
    },
    plans: publicPlans(),
    providers: providerHealth(c.env),
    recentAudit: audit,
    timestamp: now(),
  });
});

admin.get('/users', async (c) => {
  const q = (c.req.query('q') || '').trim();
  const limit = Math.min(Number(c.req.query('limit') || 100), 500);
  const like = `%${q}%`;
  const rows = await dbAll<Record<string, unknown>>(
    c.env.DB,
    `SELECT u.id, u.email, u.name, u.created_at, u.status, u.is_platform_admin,
            MAX(o.name) AS org_name, MAX(o.id) AS org_id, MAX(o.plan) AS org_plan,
            MAX(m.role) AS role, MAX(s.status) AS subscription_status
       FROM users u
       LEFT JOIN memberships m ON m.user_id = u.id
       LEFT JOIN organizations o ON o.id = m.org_id
       LEFT JOIN subscriptions s ON s.org_id = o.id
      WHERE (? = '' OR u.email LIKE ? OR u.name LIKE ?)
      GROUP BY u.id
      ORDER BY u.created_at DESC LIMIT ?`,
    q,
    like,
    like,
    limit,
  );
  return c.json({ users: rows });
});

admin.get('/orgs', async (c) => {
  const q = (c.req.query('q') || '').trim();
  const limit = Math.min(Number(c.req.query('limit') || 100), 500);
  const like = `%${q}%`;
  const rows = await dbAll<Record<string, unknown>>(
    c.env.DB,
    `SELECT o.id, o.name, o.slug, o.plan, o.status, o.created_at, o.updated_at,
            u.email AS owner_email,
            (SELECT COUNT(*) FROM memberships m WHERE m.org_id = o.id) AS members,
            (SELECT COUNT(*) FROM lessons l WHERE l.org_id = o.id) AS lessons,
            (SELECT COUNT(*) FROM api_keys k WHERE k.org_id = o.id AND k.revoked_at IS NULL) AS api_keys,
            s.status AS subscription_status, s.seats, s.provider
       FROM organizations o
       JOIN users u ON u.id = o.owner_id
       LEFT JOIN subscriptions s ON s.org_id = o.id
      WHERE (? = '' OR o.name LIKE ? OR o.slug LIKE ? OR u.email LIKE ?)
      ORDER BY o.created_at DESC LIMIT ?`,
    q,
    like,
    like,
    like,
    limit,
  );
  return c.json({ orgs: rows });
});

admin.get('/subscriptions', async (c) => {
  const rows = await dbAll<Record<string, unknown>>(
    c.env.DB,
    `SELECT s.*, o.name AS org_name, o.slug, u.email AS owner_email
       FROM subscriptions s
       JOIN organizations o ON o.id = s.org_id
       JOIN users u ON u.id = o.owner_id
      ORDER BY s.updated_at DESC LIMIT 200`,
  );
  return c.json({ subscriptions: rows });
});

admin.get('/usage', async (c) => {
  const days = Math.min(Math.max(Number(c.req.query('days') || 30), 1), 90);
  const since = now() - days * 86_400_000;
  const rows = await dbAll<{ day: string; kind: string; n: number }>(
    c.env.DB,
    `SELECT date(created_at / 1000, 'unixepoch') AS day, kind, COUNT(*) AS n
       FROM usage_events WHERE created_at > ?
      GROUP BY day, kind ORDER BY day ASC`,
    since,
  );
  return c.json({ days, usage: rows });
});

admin.get('/audit', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') || 100), 500);
  const rows = await dbAll<Record<string, unknown>>(
    c.env.DB,
    `SELECT a.*, u.email AS actor_email, o.name AS org_name
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.actor_id
       LEFT JOIN organizations o ON o.id = a.org_id
      ORDER BY a.created_at DESC LIMIT ?`,
    limit,
  );
  return c.json({ audit: rows });
});

admin.get('/providers', (c) => {
  const health = providerHealth(c.env);
  return c.json({
    providers: health,
    configured: health.filter((p) => p.available).length,
    total: health.length,
    freellmapi: Boolean(c.env.FREELLMAPI_BASE_URL),
    keyless: health.filter((p) => p.keyless).length,
  });
});

admin.get('/api-keys', async (c) => {
  const rows = await dbAll<Record<string, unknown>>(
    c.env.DB,
    `SELECT k.id, k.name, k.prefix, k.scopes, k.created_at, k.last_used_at, k.revoked_at,
            u.email, o.name AS org_name
       FROM api_keys k
       JOIN users u ON u.id = k.user_id
       JOIN organizations o ON o.id = k.org_id
      ORDER BY k.created_at DESC LIMIT 200`,
  );
  return c.json({ apiKeys: rows });
});

admin.delete('/api-keys/:id', async (c) => {
  await dbRun(c.env.DB, 'UPDATE api_keys SET revoked_at = ? WHERE id = ?', now(), c.req.param('id'));
  await recordAudit(c.env.DB, {
    orgId: c.get('org')?.id,
    actorId: c.get('user')?.id,
    action: 'admin.api_key.revoke',
    target: c.req.param('id'),
    ip: c.req.header('cf-connecting-ip'),
  });
  return c.json({ ok: true });
});

admin.patch('/orgs/:id', async (c) => {
  const id = c.req.param('id');
  const body = (await c.req.json().catch(() => ({}))) as { plan?: string; status?: string; seats?: number };
  const org = await dbFirst<{ id: string; plan: string; status: string }>(
    c.env.DB,
    'SELECT id, plan, status FROM organizations WHERE id = ?',
    id,
  );
  if (!org) return c.json({ error: 'organization not found' }, 404);
  const plan = body.plan && PLANS[body.plan as PlanId] ? (body.plan as PlanId) : org.plan;
  const status = body.status && ['active', 'suspended', 'deleted'].includes(body.status) ? body.status : org.status;
  const seats = Number.isFinite(body.seats) ? Math.max(1, Number(body.seats)) : PLANS[plan as PlanId]?.seats || 1;
  const ts = now();
  await dbRun(
    c.env.DB,
    'UPDATE organizations SET plan = ?, status = ?, updated_at = ? WHERE id = ?',
    plan,
    status,
    ts,
    id,
  );
  await dbRun(
    c.env.DB,
    `INSERT INTO subscriptions (id, org_id, plan, status, seats, provider, created_at, updated_at)
     VALUES (?, ?, ?, 'active', ?, 'manual', ?, ?)
     ON CONFLICT(org_id) DO UPDATE SET plan = excluded.plan, status = 'active', seats = excluded.seats,
       provider = 'manual', updated_at = excluded.updated_at`,
    `sub_${id}`,
    id,
    plan,
    seats,
    ts,
    ts,
  );
  await recordAudit(c.env.DB, {
    orgId: id,
    actorId: c.get('user')?.id,
    action: 'admin.org.update',
    target: id,
    meta: { plan, status, seats },
    ip: c.req.header('cf-connecting-ip'),
  });
  return c.json({ ok: true, org: { id, plan, status, seats } });
});

admin.patch('/users/:id', async (c) => {
  const id = c.req.param('id');
  const body = (await c.req.json().catch(() => ({}))) as { status?: string; isPlatformAdmin?: boolean };
  const user = await dbFirst<{ id: string; status: string; is_platform_admin: number }>(
    c.env.DB,
    'SELECT id, status, is_platform_admin FROM users WHERE id = ?',
    id,
  );
  if (!user) return c.json({ error: 'user not found' }, 404);
  const status = body.status && ['active', 'suspended'].includes(body.status) ? body.status : user.status;
  const isAdmin = typeof body.isPlatformAdmin === 'boolean' ? Number(body.isPlatformAdmin) : user.is_platform_admin;
  await dbRun(c.env.DB, 'UPDATE users SET status = ?, is_platform_admin = ? WHERE id = ?', status, isAdmin, id);
  await recordAudit(c.env.DB, {
    orgId: c.get('org')?.id,
    actorId: c.get('user')?.id,
    action: 'admin.user.update',
    target: id,
    meta: { status, isPlatformAdmin: Boolean(isAdmin) },
    ip: c.req.header('cf-connecting-ip'),
  });
  return c.json({ ok: true, user: { id, status, isPlatformAdmin: Boolean(isAdmin) } });
});

admin.get('/payment-requests', async (c) => {
  const rows = await dbAll<Record<string, unknown>>(
    c.env.DB,
    `SELECT p.*, o.name AS org_name, o.slug, u.email AS user_email, s.plan AS current_plan
       FROM payment_requests p
       JOIN organizations o ON o.id = p.org_id
       JOIN users u ON u.id = p.user_id
       LEFT JOIN subscriptions s ON s.org_id = p.org_id
      ORDER BY CASE p.status WHEN 'pending' THEN 0 ELSE 1 END, p.created_at DESC LIMIT 200`,
  );
  return c.json({ requests: rows });
});

admin.post('/payment-requests/:id/approve', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { days?: number; seats?: number };
  const result = await approvePaymentRequest(c.env.DB, c.req.param('id'), c.get('user')?.id || 'platform-token', {
    days: Number(body.days) || undefined,
    seats: Number(body.seats) || undefined,
  });
  if ('error' in result) return c.json(result, 400);
  return c.json({ ok: true, activationCode: result.raw, request: result.request });
});

admin.post('/payment-requests/:id/reject', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { note?: string };
  const id = c.req.param('id');
  const req = await dbFirst<{ id: string; org_id: string; status: string }>(
    c.env.DB, 'SELECT id, org_id, status FROM payment_requests WHERE id = ?', id,
  );
  if (!req) return c.json({ error: 'Payment request not found' }, 404);
  await dbRun(c.env.DB, "UPDATE payment_requests SET status = 'rejected', reviewed_at = ?, reviewed_by = ? WHERE id = ?", now(), c.get('user')?.id || null, id);
  await recordAudit(c.env.DB, {
    orgId: req.org_id,
    actorId: c.get('user')?.id,
    action: 'admin.payment.reject',
    target: id,
    meta: { note: body.note || '' },
  });
  return c.json({ ok: true });
});

admin.get('/activation-codes', async (c) => {
  const rows = await dbAll<Record<string, unknown>>(
    c.env.DB,
    `SELECT id, prefix, plan, seats, days, max_uses, uses, note, created_by, expires_at, revoked_at, created_at
       FROM activation_codes ORDER BY created_at DESC LIMIT 200`,
  );
  return c.json({ codes: rows });
});

admin.post('/activation-codes', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    plan?: string; seats?: number; days?: number; maxUses?: number; note?: string; expiresAt?: number;
  };
  const result = await createActivationCode(c.env.DB, {
    plan: body.plan || 'pro',
    seats: Number(body.seats) || undefined,
    days: Number(body.days) || undefined,
    maxUses: Number(body.maxUses) || undefined,
    note: body.note,
    createdBy: c.get('user')?.id,
    expiresAt: Number(body.expiresAt) || undefined,
  });
  await recordAudit(c.env.DB, {
    orgId: c.get('org')?.id,
    actorId: c.get('user')?.id,
    action: 'admin.activation_code.create',
    target: result.record.id,
    meta: { plan: result.record.plan, seats: result.record.seats, days: result.record.days },
  });
  return c.json({ ok: true, code: result.raw, record: result.record }, 201);
});

admin.post('/activation-codes/:id/revoke', async (c) => {
  await dbRun(c.env.DB, 'UPDATE activation_codes SET revoked_at = ? WHERE id = ?', now(), c.req.param('id'));
  await recordAudit(c.env.DB, {
    orgId: c.get('org')?.id,
    actorId: c.get('user')?.id,
    action: 'admin.activation_code.revoke',
    target: c.req.param('id'),
  });
  return c.json({ ok: true });
});

export default admin;
