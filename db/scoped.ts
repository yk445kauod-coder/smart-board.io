import { drizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless';
import type { Pool, PoolClient } from '@neondatabase/serverless';
import { z } from 'zod';
import * as schema from './schema';
import type { Role } from '../shared/auth/roles';

export type ScopedDb = NeonDatabase<typeof schema>;

export interface OrgContext {
  orgId: string;
  userId: string;
  role: Role;
}

const OrgId = z.string().uuid();

async function beginScoped(
  pool: Pool,
  settings: { userId: string; orgId?: string },
): Promise<{ client: PoolClient; db: ScopedDb }> {
  if (settings.orgId) OrgId.parse(settings.orgId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE app_user');
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [settings.userId]);
    if (settings.orgId) {
      await client.query("SELECT set_config('app.current_org_id', $1, true)", [settings.orgId]);
    }
    return { client, db: drizzle(client, { schema }) };
  } catch (error) {
    client.release();
    throw error;
  }
}

/**
 * The single gateway for organisation-scoped queries. Missing org context is a
 * programming error, not a valid query. RLS is also enforced in Postgres.
 */
export async function withOrg<T>(pool: Pool, ctx: OrgContext, fn: (db: ScopedDb) => Promise<T>): Promise<T> {
  if (!ctx.orgId) throw new Error('org context is required');
  const { client, db } = await beginScoped(pool, { userId: ctx.userId, orgId: ctx.orgId });
  try {
    const result = await fn(db);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Identity-scoped queries (listing your own organisations) before an org is chosen. */
export async function withUser<T>(pool: Pool, userId: string, fn: (db: ScopedDb) => Promise<T>): Promise<T> {
  if (!userId) throw new Error('user id is required');
  const { client, db } = await beginScoped(pool, { userId });
  try {
    const result = await fn(db);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
