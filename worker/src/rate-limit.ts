import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { dbFirst } from './db';
import type { AppEnv } from './env';

/**
 * Fixed-window limiter backed by D1. The upsert is atomic, so concurrent
 * requests from the same IP cannot all pass on the same window.
 */
export async function enforceRateLimit(c: Context<AppEnv>, bucket: string, limit: number, windowMs: number): Promise<void> {
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const key = bucket + ':' + ip;
  const now = Date.now();
  const row = await dbFirst<{ count: number; window_start: number }>(
    c.env.DB,
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN rate_limits.window_start <= ? THEN 1 ELSE rate_limits.count + 1 END,
       window_start = CASE WHEN rate_limits.window_start <= ? THEN ? ELSE rate_limits.window_start END
     RETURNING count, window_start`,
    key,
    now,
    now - windowMs,
    now - windowMs,
    now,
  );
  if (row && row.count > limit) {
    const retry = Math.max(1, Math.ceil((row.window_start + windowMs - now) / 1000));
    c.header('Retry-After', String(retry));
    throw new HTTPException(429, { message: 'Too many requests. Try again later.' });
  }
}
