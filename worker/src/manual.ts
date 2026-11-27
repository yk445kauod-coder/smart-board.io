import { Hono } from 'hono';
import type { AppEnv, Env } from './env';
import { requireAuth, requireOrg, requireRole } from './auth';
import { dbFirst, dbRun, newId, now } from './db';
import { PLANS, getPlan, type PlanId } from './plans';
import { hashApiKey, recordAudit } from './orgs';

const manual = new Hono<AppEnv>();

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const randomCode = (): string => {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes).map((b) => ALPHABET[b % ALPHABET.length]);
  return 'SB-' + chars.slice(0, 4).join('') + '-' + chars.slice(4, 8).join('') + '-' + chars.slice(8, 12).join('');
};

export interface ActivationCode {
  id: string;
  prefix: string;
  plan: string;
  seats: number;
  days: number;
  max_uses: number;
  uses: number;
  note?: string | null;
  created_by?: string | null;
  expires_at?: number | null;
  revoked_at?: number | null;
  created_at: number;
}

export async function createActivationCode(
  db: D1Database,
  input: {
    plan: string;
    seats?: number;
    days?: number;
    maxUses?: number;
    note?: string;
    createdBy?: string;
    expiresAt?: number;
  },
): Promise<{ raw: string; record: ActivationCode }> {
  const plan = PLANS[input.plan as PlanId] ? input.plan : 'pro';
  const raw = randomCode();
  const record: ActivationCode = {
    id: newId(),
    prefix: raw.slice(0, 7),
    plan,
    seats: input.seats || PLANS[plan as PlanId].seats,
    days: input.days || 30,
    max_uses: input.maxUses || 1,
    uses: 0,
    note: input.note || null,
    created_by: input.createdBy || null,
    expires_at: input.expiresAt || null,
    created_at: now(),
  };
  await dbRun(
    db,
    `INSERT INTO activation_codes
       (id, code_hash, prefix, plan, seats, days, max_uses, uses, note, created_by, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
    record.id,
    await hashApiKey(raw),
    record.prefix,
    record.plan,
    record.seats,
    record.days,
    record.max_uses,
    record.note ?? null,
    record.created_by ?? null,
    record.expires_at ?? null,
    record.created_at,
  );
  return { raw, record };
}

export async function redeemActivationCode(
  db: D1Database,
  raw: string,
  orgId: string,
  userId: string,
): Promise<{ ok: true; plan: string; seats: number; periodEnd: number } | { ok: false; error: string }> {
  const code = await dbFirst<ActivationCode & { code_hash: string }>(
    db,
    'SELECT * FROM activation_codes WHERE code_hash = ?',
    await hashApiKey(raw.trim().toUpperCase()),
  );
  if (!code) return { ok: false, error: 'Invalid activation code' };
  if (code.revoked_at) return { ok: false, error: 'This code has been revoked' };
  if (code.uses >= code.max_uses) return { ok: false, error: 'This code has already been used' };
  if (code.expires_at && code.expires_at < now()) return { ok: false, error: 'This code has expired' };

  const ts = now();
  const periodEnd = ts + code.days * 86_400_000;
  await dbRun(db, 'UPDATE organizations SET plan = ?, updated_at = ? WHERE id = ?', code.plan, ts, orgId);
  await dbRun(
    db,
    `INSERT INTO subscriptions
       (id, org_id, plan, status, seats, provider, current_period_start, current_period_end, created_at, updated_at)
     VALUES (?, ?, ?, 'active', ?, 'manual', ?, ?, ?, ?)
     ON CONFLICT(org_id) DO UPDATE SET plan = excluded.plan, status = 'active', seats = excluded.seats,
       provider = 'manual', current_period_start = excluded.current_period_start,
       current_period_end = excluded.current_period_end, updated_at = excluded.updated_at`,
    'sub_' + orgId,
    orgId,
    code.plan,
    code.seats,
    ts,
    periodEnd,
    ts,
    ts,
  );
  await dbRun(db, 'UPDATE activation_codes SET uses = uses + 1 WHERE id = ?', code.id);
  await recordAudit(db, {
    orgId,
    actorId: userId,
    action: 'billing.code.redeem',
    target: code.id,
    meta: { plan: code.plan, seats: code.seats, days: code.days },
  });
  return { ok: true, plan: code.plan, seats: code.seats, periodEnd };
}

export async function approvePaymentRequest(
  db: D1Database,
  requestId: string,
  reviewerId: string,
  overrides: { days?: number; seats?: number } = {},
): Promise<{ raw: string; request: Record<string, unknown> } | { error: string }> {
  const req = await dbFirst<{
    id: string; org_id: string; user_id: string; plan: string; status: string; amount_egp: number;
  }>(db, 'SELECT * FROM payment_requests WHERE id = ?', requestId);
  if (!req) return { error: 'Payment request not found' };
  if (req.status !== 'pending') return { error: 'Payment request is already ' + req.status };
  const plan = getPlan(req.plan);
  const code = await createActivationCode(db, {
    plan: plan.id,
    seats: overrides.seats || plan.seats,
    days: overrides.days || 30,
    maxUses: 1,
    note: `Payment request ${req.id} · EGP ${req.amount_egp}`,
    createdBy: reviewerId,
  });
  const ts = now();
  await dbRun(
    db,
    "UPDATE payment_requests SET status = 'approved', reviewed_at = ?, reviewed_by = ?, activation_code_id = ? WHERE id = ?",
    ts,
    reviewerId,
    code.record.id,
    req.id,
  );
  await recordAudit(db, {
    orgId: req.org_id,
    actorId: reviewerId,
    action: 'admin.payment.approve',
    target: req.id,
    meta: { plan: plan.id, codeId: code.record.id },
  });
  return { raw: code.raw, request: { ...req, status: 'approved', reviewed_at: ts, reviewed_by: reviewerId, activation_code_id: code.record.id } };
}

manual.get('/manual-instructions', (c) =>
  c.json({
    currency: 'EGP',
    contact: c.env.PAYMENT_CONTACT || 'Contact the SmartBoard team',
    whatsapp: c.env.PAYMENT_WHATSAPP || null,
    methods: [
      {
        id: 'instapay',
        name: 'InstaPay',
        value: c.env.PAYMENT_INSTAPAY || 'Ask for the InstaPay address',
        note: 'Send the exact plan amount, then submit the transfer reference.',
      },
      {
        id: 'cash_wallet',
        name: 'Cash wallet',
        value: c.env.PAYMENT_WALLET || 'Ask for the wallet number',
        note: 'Vodafone Cash / Etisalat Cash / Orange Cash. Send the screenshot and reference.',
      },
      {
        id: 'bank_transfer',
        name: 'Bank transfer',
        value: c.env.PAYMENT_BANK || 'Ask for bank details',
        note: 'For schools and districts. A call is scheduled before activation.',
      },
    ],
    steps: [
      'Choose a plan and contact the team (WhatsApp or a short call).',
      'Pay by InstaPay, cash wallet, or bank transfer using the exact amount.',
      'Submit the transfer reference in the app.',
      'The team reviews it and sends a one-time activation code.',
      'Redeem the code to activate the plan for 30 days.',
    ],
    plans: Object.values(PLANS).map((p) => ({ id: p.id, name: p.name, priceEgp: p.priceEgp, seats: p.seats })),
  }),
);

manual.post('/manual-request', requireAuth, requireOrg, requireRole('owner', 'admin'), async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    plan?: string; method?: string; reference?: string; note?: string;
  };
  const plan = getPlan(body.plan);
  if (plan.id === 'free') return c.json({ error: 'Choose Pro, School, or Enterprise' }, 400);
  const method = body.method || 'instapay';
  if (!['instapay', 'cash_wallet', 'bank_transfer'].includes(method)) {
    return c.json({ error: 'method must be instapay, cash_wallet, or bank_transfer' }, 400);
  }
  const id = newId();
  const org = c.get('org')!;
  const user = c.get('user')!;
  await dbRun(
    c.env.DB,
    `INSERT INTO payment_requests (id, org_id, user_id, plan, method, reference, amount_egp, note, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    id,
    org.id,
    user.id,
    plan.id,
    method,
    (body.reference || '').slice(0, 120),
    plan.priceEgp,
    (body.note || '').slice(0, 500),
    now(),
  );
  await recordAudit(c.env.DB, {
    orgId: org.id,
    actorId: user.id,
    action: 'billing.manual.request',
    target: id,
    meta: { plan: plan.id, method },
    ip: c.req.header('cf-connecting-ip'),
  });
  return c.json({
    ok: true,
    request: {
      id,
      plan: plan.id,
      method,
      amountEgp: plan.priceEgp,
      status: 'pending',
      message: 'We will review the transfer and send an activation code after confirmation.',
    },
  }, 201);
});

manual.get('/manual-requests', requireAuth, requireOrg, async (c) => {
  const org = c.get('org')!;
  const rows = await c.env.DB.prepare(
    'SELECT id, plan, method, reference, amount_egp, note, status, created_at, reviewed_at FROM payment_requests WHERE org_id = ? ORDER BY created_at DESC LIMIT 50',
  ).bind(org.id).all();
  return c.json({ requests: rows.results || [] });
});

manual.post('/redeem', requireAuth, requireOrg, requireRole('owner', 'admin'), async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { code?: string };
  if (!body.code) return c.json({ error: 'code is required' }, 400);
  const result = await redeemActivationCode(c.env.DB, body.code, c.get('org')!.id, c.get('user')!.id);
  if (!result.ok) return c.json({ error: result.error }, 400);
  return c.json(result);
});

manual.post('/activate', requireAuth, requireOrg, requireRole('owner', 'admin'), async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { code?: string };
  if (!body.code) return c.json({ error: 'code is required' }, 400);
  const result = await redeemActivationCode(c.env.DB, body.code, c.get('org')!.id, c.get('user')!.id);
  if (!result.ok) return c.json({ error: result.error }, 400);
  return c.json(result);
});

export default manual;
