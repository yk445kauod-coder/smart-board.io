import type { OrgContext } from '../db/scoped';

export interface Env {
  DATABASE_URL: string;
  NEON_AUTH_JWKS_URL: string;
  NEON_AUTH_BASE_URL: string;
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_ENDPOINT_URL_S3: string;
  AWS_REGION: string;
  NEON_REALTIME_URL: string;
  NEON_REALTIME_SECRET: string;
  NEON_REALTIME_DB?: string;
  APP_ORIGIN?: string;
  ENVIRONMENT?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface Variables {
  user: AuthUser;
  org: OrgContext;
  requestId: string;
}

export type AppEnv = { Bindings: Env; Variables: Variables };
