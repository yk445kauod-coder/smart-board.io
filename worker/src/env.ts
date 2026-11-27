export interface Env {
  DB: D1Database;
  AI: Ai;
  OPENROUTER_API_KEY?: string;
  GEMINI_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  FREELLMAPI_BASE_URL?: string;
  FREELLMAPI_API_KEY?: string;
  FREELLMAPI_MODEL?: string;
  APP_ORIGIN?: string;
  PUBLIC_APP_URL?: string;
  COOKIE_SECURE?: string;
  COOKIE_SAMESITE?: 'Lax' | 'None' | 'Strict';
  SESSION_DAYS?: string;
  DAILY_CHAT_LIMIT?: string;
  AUTH_RATE_LIMIT?: string;
  REGISTER_RATE_LIMIT?: string;
  PLATFORM_ADMIN_EMAILS?: string;
  PLATFORM_ADMIN_TOKEN?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_PRO?: string;
  STRIPE_PRICE_SCHOOL?: string;
  STRIPE_PORTAL_RETURN_URL?: string;
  PAYMENT_CONTACT?: string;
  PAYMENT_INSTAPAY?: string;
  PAYMENT_WALLET?: string;
  PAYMENT_BANK?: string;
  PAYMENT_WHATSAPP?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  created_at: number;
  is_platform_admin?: number;
  status?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  owner_id: string;
  created_at: number;
  updated_at: number;
}

export interface Membership {
  id: string;
  org_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'teacher' | 'viewer';
  created_at: number;
}

export interface Subscription {
  id: string;
  org_id: string;
  plan: string;
  status: string;
  seats: number;
  provider: string;
  provider_customer_id?: string | null;
  provider_subscription_id?: string | null;
  current_period_start?: number | null;
  current_period_end?: number | null;
  cancel_at_period_end?: number;
  created_at: number;
  updated_at: number;
}

export type Variables = {
  user: User;
  requestId: string;
  org?: Organization;
  membership?: Membership;
  subscription?: Subscription;
  plan?: import('./plans').PlanDef;
  apiKeyId?: string;
  authKind?: 'session' | 'api_key' | 'platform_token';
};

export type AppEnv = {
  Bindings: Env;
  Variables: Variables;
};

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  createdAt: number;
  isPlatformAdmin: boolean;
  status: string;
}

const adminEmails = (env?: Env): string[] =>
  (env?.PLATFORM_ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export const isPlatformAdmin = (u: Pick<User, 'email' | 'is_platform_admin'>, env?: Env): boolean =>
  Boolean(u.is_platform_admin) || adminEmails(env).includes(u.email.toLowerCase());

export const toPublicUser = (u: User, env?: Env): PublicUser => ({
  id: u.id,
  email: u.email,
  name: u.name,
  createdAt: u.created_at,
  isPlatformAdmin: isPlatformAdmin(u, env),
  status: u.status || 'active',
});
