import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { AppEnv, AuthUser, Env } from './env';

const jwksByUrl = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function jwks(url: string) {
  let set = jwksByUrl.get(url);
  if (!set) {
    set = createRemoteJWKSet(new URL(url));
    jwksByUrl.set(url, set);
  }
  return set;
}

function claimString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === 'string' ? value : '';
}

export async function verifyBearer(env: Env, header: string | undefined): Promise<AuthUser> {
  if (!header || !header.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'missing bearer token' });
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token || token.length > 4096) throw new HTTPException(401, { message: 'invalid token' });
  const issuer = new URL(env.NEON_AUTH_BASE_URL).origin;
  try {
    const { payload } = await jwtVerify(token, jwks(env.NEON_AUTH_JWKS_URL), {
      issuer,
      audience: issuer,
      algorithms: ['EdDSA'],
    });
    const id = payload.sub;
    if (!id) throw new Error('missing sub');
    return { id, email: claimString(payload, 'email'), name: claimString(payload, 'name') };
  } catch {
    throw new HTTPException(401, { message: 'invalid or expired session' });
  }
}

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set('user', await verifyBearer(c.env, c.req.header('authorization')));
  await next();
};
