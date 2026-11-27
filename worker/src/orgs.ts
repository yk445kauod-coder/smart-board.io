import type { Env, Membership, Organization, Subscription, User } from './env';
import { dbFirst, dbRun, newId, now } from './db';
import { getPlan } from './plans';

const enc = new TextEncoder();

const b64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
};

const b64url = (bytes: Uint8Array): string =>
  b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const randomBytes = (n: number): Uint8Array => {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
};

export const hashApiKey = async (raw: string): Promise<string> =>
  b64(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(raw))));

export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42) || 'workspace';

export interface OrgContext {
  org: Organization;
  membership: Membership;
  subscription: Subscription;
  plan: ReturnType<typeof getPlan>;
}

export async function getSubscription(db: D1Database, orgId: string): Promise<Subscription | null> {
  return dbFirst<Subscription>(db, 'SELECT * FROM subscriptions WHERE org_id = ?', orgId);
}

export async function getOrgContext(
  db: D1Database,
  userId: string,
  orgId?: string | null,
): Promise<OrgContext | null> {
  const membership = orgId
    ? await dbFirst<Membership>(db, 'SELECT * FROM memberships WHERE user_id = ? AND org_id = ?', userId, orgId)
    : await dbFirst<Membership>(
        db,
        `SELECT m.* FROM memberships m JOIN organizations o ON o.id = m.org_id
          WHERE m.user_id = ? AND o.status = 'active'
          ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, m.created_at
          LIMIT 1`,
        userId,
      );
  if (!membership) return null;
  const org = await dbFirst<Organization>(db, 'SELECT * FROM organizations WHERE id = ?', membership.org_id);
  if (!org) return null;
  const subscription =
    (await getSubscription(db, org.id)) ||
    ({
      id: 'sub_missing',
      org_id: org.id,
      plan: org.plan || 'free',
      status: 'active',
      seats: 1,
      provider: 'manual',
      created_at: org.created_at,
      updated_at: org.updated_at,
    } as Subscription);
  return { org, membership, subscription, plan: getPlan(subscription.plan || org.plan) };
}

export async function createPersonalWorkspace(db: D1Database, user: User): Promise<OrgContext> {
  const ts = now();
  const orgId = newId();
  const org: Organization = {
    id: orgId,
    name: `${user.name || user.email.split('@')[0]}'s workspace`,
    slug: `${slugify(user.name || user.email.split('@')[0])}-${orgId.slice(0, 6)}`,
    plan: 'free',
    status: 'active',
    owner_id: user.id,
    created_at: ts,
    updated_at: ts,
  };
  await dbRun(
    db,
    'INSERT INTO organizations (id, name, slug, plan, status, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    org.id,
    org.name,
    org.slug,
    org.plan,
    org.status,
    org.owner_id,
    org.created_at,
    org.updated_at,
  );
  const membership: Membership = {
    id: newId(),
    org_id: org.id,
    user_id: user.id,
    role: 'owner',
    created_at: ts,
  };
  await dbRun(
    db,
    'INSERT INTO memberships (id, org_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)',
    membership.id,
    membership.org_id,
    membership.user_id,
    membership.role,
    membership.created_at,
  );
  const subscription: Subscription = {
    id: newId(),
    org_id: org.id,
    plan: 'free',
    status: 'active',
    seats: 1,
    provider: 'manual',
    created_at: ts,
    updated_at: ts,
  };
  await dbRun(
    db,
    `INSERT INTO subscriptions (id, org_id, plan, status, seats, provider, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    subscription.id,
    subscription.org_id,
    subscription.plan,
    subscription.status,
    subscription.seats,
    subscription.provider,
    subscription.created_at,
    subscription.updated_at,
  );
  return { org, membership, subscription, plan: getPlan('free') };
}

export interface ApiKeyRecord {
  id: string;
  org_id: string;
  user_id: string;
  name: string;
  prefix: string;
  scopes: string;
  created_at: number;
  last_used_at?: number | null;
  revoked_at?: number | null;
}

export async function createApiKey(
  db: D1Database,
  input: { orgId: string; userId: string; name: string; scopes?: string },
): Promise<{ raw: string; record: ApiKeyRecord }> {
  const raw = 'sb_live_' + b64url(randomBytes(24));
  const record: ApiKeyRecord = {
    id: newId(),
    org_id: input.orgId,
    user_id: input.userId,
    name: input.name.slice(0, 60) || 'Default key',
    prefix: raw.slice(0, 15),
    scopes: input.scopes || 'read,write',
    created_at: now(),
  };
  await dbRun(
    db,
    `INSERT INTO api_keys (id, org_id, user_id, name, prefix, key_hash, scopes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    record.id,
    record.org_id,
    record.user_id,
    record.name,
    record.prefix,
    await hashApiKey(raw),
    record.scopes,
    record.created_at,
  );
  return { raw, record };
}

export async function findApiKey(
  db: D1Database,
  raw: string,
): Promise<{ key: ApiKeyRecord; user: User } | null> {
  const key = await dbFirst<ApiKeyRecord & { key_hash: string }>(
    db,
    'SELECT * FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL',
    await hashApiKey(raw),
  );
  if (!key) return null;
  const user = await dbFirst<User>(
    db,
    'SELECT id, email, name, created_at, is_platform_admin, status FROM users WHERE id = ?',
    key.user_id,
  );
  if (!user) return null;
  await dbRun(db, 'UPDATE api_keys SET last_used_at = ? WHERE id = ?', now(), key.id).catch(() => undefined);
  return { key, user };
}

export async function recordAudit(
  db: D1Database,
  input: {
    orgId?: string | null;
    actorId?: string | null;
    action: string;
    target?: string | null;
    meta?: unknown;
    ip?: string | null;
  },
): Promise<void> {
  await dbRun(
    db,
    `INSERT INTO audit_log (id, org_id, actor_id, action, target, meta_json, ip, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    newId(),
    input.orgId || null,
    input.actorId || null,
    input.action,
    input.target || null,
    JSON.stringify(input.meta ?? {}),
    input.ip || null,
    now(),
  ).catch(() => undefined);
}
