import { Hono } from 'hono';
import type { AppEnv, Env, Subscription } from './env';
import { requireAuth, requireOrg, requireRole } from './auth';
import { dbFirst, dbRun, now } from './db';
import { PLANS, publicPlans, type PlanId } from './plans';
import { recordAudit } from './orgs';

const billing = new Hono<AppEnv>();

const stripeConfigured = (env: Env): boolean => Boolean(env.STRIPE_SECRET_KEY);
const appUrl = (env: Env): string => (env.PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const priceFor = (env: Env, plan: string): string => {
  if (plan === 'pro') return env.STRIPE_PRICE_PRO || '';
  if (plan === 'school') return env.STRIPE_PRICE_SCHOOL || '';
  return '';
};

const stripePost = async (env: Env, path: string, form: URLSearchParams): Promise<Record<string, unknown>> => {
  const res = await fetch('https://api.stripe.com/v1' + path, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = data.error as { message?: string } | undefined;
    throw new Error(err?.message || 'Stripe HTTP ' + res.status);
  }
  return data;
};

const hex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const safeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

async function verifyStripeSignature(env: Env, raw: string, header: string): Promise<boolean> {
  if (!env.STRIPE_WEBHOOK_SECRET) return false;
  const parts = header.split(',').reduce<Record<string, string>>((acc, part) => {
    const [k, v] = part.split('=');
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});
  const timestamp = Number(parts.t || 0);
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${parts.t}.${raw}`)));
  return safeEqual(hex(mac), parts.v1 || '');
}

const upsertStripeSubscription = async (
  env: Env,
  input: {
    orgId: string;
    plan: string;
    status: string;
    customerId?: string | null;
    subscriptionId?: string | null;
    periodStart?: number | null;
    periodEnd?: number | null;
    cancelAtPeriodEnd?: boolean;
  },
): Promise<void> => {
  const ts = now();
  const plan = PLANS[input.plan as PlanId] ? input.plan : 'pro';
  await dbRun(
    env.DB,
    `INSERT INTO subscriptions
       (id, org_id, plan, status, seats, provider, provider_customer_id, provider_subscription_id,
        current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'stripe', ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(org_id) DO UPDATE SET
       plan = excluded.plan, status = excluded.status, seats = excluded.seats, provider = 'stripe',
       provider_customer_id = COALESCE(excluded.provider_customer_id, subscriptions.provider_customer_id),
       provider_subscription_id = COALESCE(excluded.provider_subscription_id, subscriptions.provider_subscription_id),
       current_period_start = COALESCE(excluded.current_period_start, subscriptions.current_period_start),
       current_period_end = COALESCE(excluded.current_period_end, subscriptions.current_period_end),
       cancel_at_period_end = excluded.cancel_at_period_end, updated_at = excluded.updated_at`,
    'sub_' + input.orgId,
    input.orgId,
    plan,
    input.status,
    PLANS[plan as PlanId].seats,
    input.customerId || null,
    input.subscriptionId || null,
    input.periodStart || null,
    input.periodEnd || null,
    input.cancelAtPeriodEnd ? 1 : 0,
    ts,
    ts,
  );
  await dbRun(env.DB, 'UPDATE organizations SET plan = ?, updated_at = ? WHERE id = ?', plan, ts, input.orgId);
};

billing.get('/plans', (c) => c.json({ plans: publicPlans(), currency: 'EGP' }));

billing.get('/config', (c) =>
  c.json({
    stripe: stripeConfigured(c.env),
    publishableKey: null,
    plans: publicPlans(),
    currency: 'EGP',
  }),
);

billing.get('/subscription', requireAuth, requireOrg, (c) =>
  c.json({
    subscription: c.get('subscription'),
    plan: c.get('plan'),
    org: c.get('org'),
  }),
);

billing.post('/checkout', requireAuth, requireOrg, requireRole('owner', 'admin'), async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { plan?: string };
  const plan = body.plan || 'pro';
  if (!PLANS[plan as PlanId] || plan === 'free' || plan === 'enterprise') {
    return c.json({ error: 'Choose a self-serve plan: pro or school' }, 400);
  }
  if (!stripeConfigured(c.env)) {
    return c.json({
      configured: false,
      error: 'Billing is not configured yet. Ask the platform admin to enable Stripe or set a plan manually.',
      plan,
    }, 503);
  }
  const price = priceFor(c.env, plan);
  if (!price) return c.json({ error: `Missing Stripe price id for ${plan}` }, 503);
  const org = c.get('org')!;
  const form = new URLSearchParams();
  form.set('mode', 'subscription');
  form.set('line_items[0][price]', price);
  form.set('line_items[0][quantity]', '1');
  form.set('success_url', `${appUrl(c.env)}/billing/success?session_id={CHECKOUT_SESSION_ID}`);
  form.set('cancel_url', `${appUrl(c.env)}/pricing`);
  form.set('client_reference_id', org.id);
  form.set('metadata[org_id]', org.id);
  form.set('metadata[plan]', plan);
  form.set('subscription_data[metadata][org_id]', org.id);
  form.set('subscription_data[metadata][plan]', plan);
  form.set('allow_promotion_codes', 'true');
  try {
    const session = await stripePost(c.env, '/checkout/sessions', form);
    await recordAudit(c.env.DB, {
      orgId: org.id,
      actorId: c.get('user')?.id,
      action: 'billing.checkout.create',
      target: String(session.id || ''),
      meta: { plan },
      ip: c.req.header('cf-connecting-ip'),
    });
    return c.json({ configured: true, url: session.url, id: session.id });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Stripe checkout failed' }, 502);
  }
});

billing.post('/portal', requireAuth, requireOrg, requireRole('owner', 'admin'), async (c) => {
  if (!stripeConfigured(c.env)) return c.json({ configured: false, error: 'Billing is not configured' }, 503);
  const sub = c.get('subscription') as Subscription | undefined;
  if (!sub?.provider_customer_id) return c.json({ error: 'No Stripe customer on this workspace' }, 400);
  const form = new URLSearchParams();
  form.set('customer', sub.provider_customer_id);
  form.set('return_url', c.env.STRIPE_PORTAL_RETURN_URL || `${appUrl(c.env)}/pricing`);
  try {
    const session = await stripePost(c.env, '/billing_portal/sessions', form);
    return c.json({ configured: true, url: session.url });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Stripe portal failed' }, 502);
  }
});

billing.post('/webhook', async (c) => {
  const raw = await c.req.text();
  const signature = c.req.header('stripe-signature') || '';
  if (!(await verifyStripeSignature(c.env, raw, signature))) {
    return c.json({ error: 'invalid signature' }, 400);
  }
  let event: { id?: string; type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(raw);
  } catch {
    return c.json({ error: 'invalid json' }, 400);
  }
  const obj = event.data?.object || {};
  const metadata = (obj.metadata || {}) as Record<string, string>;
  const orgId = metadata.org_id || (obj.client_reference_id as string) || '';
  try {
    if (event.type === 'checkout.session.completed' && orgId) {
      await upsertStripeSubscription(c.env, {
        orgId,
        plan: metadata.plan || 'pro',
        status: 'active',
        customerId: (obj.customer as string) || null,
        subscriptionId: (obj.subscription as string) || null,
      });
    } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subId = (obj.id as string) || '';
      const row = await dbFirst<Subscription>(
        c.env.DB,
        'SELECT * FROM subscriptions WHERE provider_subscription_id = ?',
        subId,
      );
      const targetOrg = row?.org_id || orgId;
      if (targetOrg) {
        const status = event.type.endsWith('deleted') ? 'canceled' : ((obj.status as string) || 'active');
        const plan = metadata.plan || row?.plan || 'pro';
        await upsertStripeSubscription(c.env, {
          orgId: targetOrg,
          plan,
          status,
          customerId: (obj.customer as string) || null,
          subscriptionId: subId,
          periodStart: obj.current_period_start ? Number(obj.current_period_start) * 1000 : null,
          periodEnd: obj.current_period_end ? Number(obj.current_period_end) * 1000 : null,
          cancelAtPeriodEnd: Boolean(obj.cancel_at_period_end),
        });
      }
    } else if (event.type === 'invoice.payment_failed' && orgId) {
      await dbRun(c.env.DB, "UPDATE subscriptions SET status = 'past_due', updated_at = ? WHERE org_id = ?", now(), orgId);
    }
    return c.json({ received: true });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'webhook failed' }, 500);
  }
});

export default billing;
