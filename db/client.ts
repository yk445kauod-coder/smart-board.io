import { Pool, neonConfig } from '@neondatabase/serverless';

// Cloudflare Workers expose a global WebSocket; Node 22+ does too. The
// serverless driver uses it for session-scoped transactions (SET LOCAL ROLE).
if (typeof WebSocket !== 'undefined') {
  neonConfig.webSocketConstructor = WebSocket;
}

const options = {
  max: 2,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
  maxLifetimeSeconds: 0,
};

/**
 * Workers forbid reusing I/O objects across request contexts, so the API creates
 * one pool per request. Node scripts can keep a cached pool via getPool().
 */
export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString, ...options });
}

let cached: Pool | undefined;

export function getPool(connectionString: string): Pool {
  if (!cached) cached = createPool(connectionString);
  return cached;
}

export async function closePool(): Promise<void> {
  if (cached) {
    const p = cached;
    cached = undefined;
    await p.end();
  }
}
