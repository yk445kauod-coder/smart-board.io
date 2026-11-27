import { createMiddleware } from 'hono/factory';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Context } from 'hono';
import type { AppEnv, Env, User } from './env';
import { isPlatformAdmin } from './env';
import { dbFirst, dbRun, newId, now } from './db';
import { findApiKey, getOrgContext } from './orgs';
import type { PlanDef } from './plans';

export const SESSION_COOKIE = 'sb_session';
const PBKDF2_ITERATIONS = 210_000;
const enc = new TextEncoder();

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
};

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
};

const bytesToBase64Url = (bytes: Uint8Array): string =>
  bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const randomBytes = (n: number): Uint8Array => {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
};

const sha256 = async (text: string): Promise<Uint8Array> => {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return new Uint8Array(digest);
};

const constantTimeEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
};

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16);
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  );
  return { hash: bytesToBase64(new Uint8Array(bits)), salt: bytesToBase64(salt) };
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  try {
    const saltBytes = base64ToBytes(salt);
    const expected = base64ToBytes(hash);
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
      key,
      expected.length * 8,
    );
    return constantTimeEqual(new Uint8Array(bits), expected);
  } catch {
    return false;
  }
}

export interface Session {
  token: string;
  expiresAt: number;
}

export async function createSession(db: D1Database, userId: string, days = 30): Promise<Session> {
  const token = bytesToBase64Url(randomBytes(32));
  const tokenHash = bytesToBase64(await sha256(token));
  const expiresAt = now() + days * 86_400_000;
  await dbRun(
    db,
    'INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
    newId(),
    userId,
    tokenHash,
    expiresAt,
    now(),
  );
  return { token, expiresAt };
}

export async function getSessionUser(db: D1Database, token: string): Promise<User | null> {
  const tokenHash = bytesToBase64(await sha256(token));
  return dbFirst<User>(
    db,
    `SELECT u.id, u.email, u.name, u.created_at, u.is_platform_admin, u.status
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?`,
    tokenHash,
    now(),
  );
}

export async function deleteSession(db: D1Database, token: string): Promise<void> {
  const tokenHash = bytesToBase64(await sha256(token));
  await dbRun(db, 'DELETE FROM sessions WHERE token_hash = ?', tokenHash);
}

export function setSessionCookie(c: Context<AppEnv>, token: string, env: Env): void {
  const days = Number(env.SESSION_DAYS || 30);
  const secure = env.COOKIE_SECURE !== 'false';
  const sameSite = env.COOKIE_SAMESITE || (secure ? 'None' : 'Lax');
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: days * 86_400,
  });
}

export function clearSessionCookie(c: Context<AppEnv>, env: Env): void {
  const secure = env.COOKIE_SECURE !== 'false';
  const sameSite = env.COOKIE_SAMESITE || (secure ? 'None' : 'Lax');
  deleteCookie(c, SESSION_COOKIE, { path: '/', secure, sameSite });
}

export const getBearerToken = (c: Context<AppEnv>): string => {
  const auth = c.req.header('authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return c.req.header('x-api-key') || '';
};

const applyOrgContext = async (c: Context<AppEnv>, userId: string, orgId?: string | null): Promise<boolean> => {
  const ctx = await getOrgContext(c.env.DB, userId, orgId);
  if (!ctx) return false;
  c.set('org', ctx.org);
  c.set('membership', ctx.membership);
  c.set('subscription', ctx.subscription);
  c.set('plan', ctx.plan);
  return true;
};

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    const user = await getSessionUser(c.env.DB, token);
    if (user) {
      if ((user.status || 'active') !== 'active') return c.json({ error: 'account suspended' }, 403);
      c.set('user', user);
      c.set('authKind', 'session');
      await next();
      return;
    }
    clearSessionCookie(c, c.env);
  }

  const raw = getBearerToken(c);
  if (raw) {
    const found = await findApiKey(c.env.DB, raw);
    if (found) {
      if ((found.user.status || 'active') !== 'active') return c.json({ error: 'account suspended' }, 403);
      c.set('user', found.user);
      c.set('apiKeyId', found.key.id);
      c.set('authKind', 'api_key');
      if (!(await applyOrgContext(c, found.user.id, found.key.org_id))) {
        return c.json({ error: 'workspace not found' }, 403);
      }
      await next();
      return;
    }
  }

  return c.json({ error: 'unauthorized' }, 401, {
    'WWW-Authenticate': 'Bearer realm="smartboard", error="invalid_token"',
  });
});

export const requireOrg = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get('org')) {
    await next();
    return;
  }
  const user = c.get('user');
  const requested = c.req.header('x-org-id') || c.req.query('org') || null;
  if (!(await applyOrgContext(c, user.id, requested))) {
    return c.json({ error: 'no active workspace' }, 403);
  }
  await next();
});

export const requireRole = (...roles: Array<'owner' | 'admin' | 'teacher' | 'viewer'>) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const role = c.get('membership')?.role;
    if (!role || !roles.includes(role)) return c.json({ error: 'forbidden' }, 403);
    await next();
  });

export const requirePlatformAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const platformToken = c.env.PLATFORM_ADMIN_TOKEN;
  if (platformToken && c.req.header('x-platform-token') === platformToken) {
    c.set('authKind', 'platform_token');
    await next();
    return;
  }
  const user = c.get('user');
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  if (!isPlatformAdmin(user, c.env)) return c.json({ error: 'platform admin only' }, 403);
  await next();
});

export const requirePlanFeature = (feature: 'api' | 'mcp' | 'priorityRouting') =>
  createMiddleware<AppEnv>(async (c, next) => {
    const plan = c.get('plan') as PlanDef | undefined;
    if (!plan || !plan[feature]) {
      return c.json({ error: `The ${feature} feature requires a paid plan`, upgrade: true }, 402);
    }
    await next();
  });
