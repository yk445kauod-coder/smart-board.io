# Operations Runbook

> **Legacy / غير منفّذ في الإنتاج:** هذا الملف يصف Worker القديم على D1 (`worker/`).
> لوحة `/admin` الإنتاجية على Neon هي المرحلة 3 ولم تُنفّذ بعد. لا تستخدم أوامر D1 أدناه
> على بيئة الإنتاج.



## Local

```bash
npm install
cp worker/.dev.vars.example worker/.dev.vars
npm run db:migrate:local
npm run worker:dev      # :8787
npm run dev             # :3000, proxies /api to :8787
```

Health: `curl http://localhost:8787/health`
Admin: `http://localhost:8787/admin`
Docs: `http://localhost:8787/docs`

## Environment

### Worker vars (`worker/wrangler.toml`)

| Var | Default | Purpose |
| :--- | :--- | :--- |
| `APP_ORIGIN` | `https://smartboard-eg.pages.dev` | CORS allowlist (comma-separated) |
| `PUBLIC_APP_URL` | `https://smartboard-eg.pages.dev` | Stripe success/cancel redirects |
| `COOKIE_SECURE` | `true` in committed prod config | Secure cookie flag |
| `COOKIE_SAMESITE` | `None` in committed prod config | Cookie policy |
| `SESSION_DAYS` | `30` | Session lifetime |
| `DAILY_CHAT_LIMIT` | `50` | Overrides plan daily chats for all plans (testing) |
| `AUTH_RATE_LIMIT` | `60` | Login attempts per 15 min per IP |
| `REGISTER_RATE_LIMIT` | `10` | Registrations per hour per IP |
| `PLATFORM_ADMIN_EMAILS` | `yk445kauod@gmail.com` | Founder allowlist |
| `PAYMENT_CONTACT` | `SmartBoard team (WhatsApp)` | Shown in payment instructions |
| `PAYMENT_WHATSAPP` | empty | WhatsApp link/number |
| `PAYMENT_INSTAPAY` | empty | InstaPay address |
| `PAYMENT_WALLET` | empty | Cash wallet number |
| `PAYMENT_BANK` | empty | Bank details |
| `FREELLMAPI_BASE_URL` | empty | Self-hosted FreeLLMAPI base URL |
| `FREELLMAPI_MODEL` | `auto` | Model sent to FreeLLMAPI |

### Secrets (`wrangler secret put`)

```bash
cd worker
wrangler secret put OPENROUTER_API_KEY
wrangler secret put GEMINI_API_KEY
wrangler secret put POLLINATIONS_API_KEY
wrangler secret put DEEPSEEK_API_KEY
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put FREELLMAPI_API_KEY
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put VAPID_PRIVATE_KEY
wrangler secret put VAPID_PUBLIC_KEY
```

Stripe price ids are vars, not secrets: `STRIPE_PRICE_PRO`, `STRIPE_PRICE_SCHOOL`.

## Migrations

```bash
npm run db:migrate:local
npm run db:migrate:remote
```

Migration order:

1. `0001_init.sql` — users, sessions, lessons, runs, usage
2. `0002_rate_limits.sql` — IP rate limits
3. `0003_saas.sql` — orgs, memberships, subscriptions, API keys, audit, org_id backfill
4. `0004_manual_payments.sql` — payment requests, activation codes
5. `0005_push.sql` — Web Push subscriptions (org/user scoped)

`0003` backfills a personal org, owner membership, free subscription, and
`org_id` for every existing user/lesson/usage/run. It is safe on a populated
database but **take a backup first**.

## First deploy

The production D1 database is `smartboard` (ENAM) with id
`d4c73a35-de91-4042-928b-3a5320dfff97`, already written into
`worker/wrangler.toml`. To create a separate database:

```bash
wrangler d1 create smartboard --config worker/wrangler.toml
```

Required Cloudflare API token permissions for non-interactive deploys:

- Account → Workers Scripts → Edit
- Account → Workers D1 → Edit
- Account → Cloudflare Pages → Edit
- Account → Account Settings → Read
- User → User Details → Read (for `wrangler whoami`)

Set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the shell or CI secrets.
Never commit the token.

## Deploy

Live production:

- Frontend: <https://smartboard-eg.pages.dev>
- Worker: <https://smartboard-api.yk445kauod.workers.dev>
- D1: `smartboard` (`d4c73a35-de91-4042-928b-3a5320dfff97`)

```bash
# 1. D1 (always before the worker code that uses it)
wrangler d1 migrations apply smartboard --remote --config worker/wrangler.toml

# 2. worker (production vars are committed in worker/wrangler.toml)
cd worker && wrangler deploy

# 3. frontend (same-origin /api proxy, no VITE_API_BASE)
cd .. && npm run build
npx wrangler pages deploy dist --project-name smartboard-eg
```

`smartboard-eg` is the Pages project; `smartboard-api` is the Worker. Both need
`CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` when running non-interactively.

The SPA uses the default `API_BASE = '/api'`. `functions/api/[[path]].ts` proxies
`/api/*` to the Worker, so session cookies are first-party. This avoids Chrome's
third-party cookie blocking and means the frontend must **not** set
`VITE_API_BASE` to the Worker host. Keep `APP_ORIGIN` as the Pages origin for
direct Worker calls and CORS preflights.

Workers PBKDF2 caps iterations at 100,000. `worker/src/auth.ts` must not exceed
that value or registration fails at runtime with `NotSupportedError`.

## Backups

D1 export before every migration:

```bash
wrangler d1 export smartboard --remote --output backup-$(date +%F).sql
```

Restore into a new database first, verify counts, then switch the binding.

## Incident checklist

1. `GET /health` — is D1 reachable?
2. `GET /v1/providers` — are providers configured?
3. Admin → AI providers — which provider is down?
4. Admin → Usage — did a plan cap cause a spike in 429s?
5. Check worker logs for `chat stream failed` with the request id.
6. If all providers fail, the offline builder should still return a valid
   script; if it does not, the bug is in the protocol validator, not the network.

## Common failures

| Symptom | Likely cause | Fix |
| :--- | :--- | :--- |
| `/admin` shows "Access denied" | Email not in `PLATFORM_ADMIN_EMAILS` and flag 0 | Set flag or add email |
| Login 401 after register | Cookie blocked by cross-site policy | Use the same-origin `/api` proxy; do not point the SPA directly at the Worker |
| Stream 503 | Concrete model key missing | Use `auto` or configure the key |
| Every stream falls to offline | Providers down or deprecated model id | Check `/v1/providers`; keep Workers AI model ids current; configure Gemini |
| Manual code invalid | Code already used/revoked/expired, or typed lowercase (handled) | Issue a new code |
| Stripe webhook 400 | Wrong `STRIPE_WEBHOOK_SECRET` or stale timestamp | Re-copy secret; retry within 5 min |
| 402 on save | Free plan 30-lesson cap | Upgrade or delete old lessons |

## Security checklist before launch

- [ ] `COOKIE_SECURE=true`, `COOKIE_SAMESITE=None` in production
- [ ] `PLATFORM_ADMIN_EMAILS` contains only founders
- [ ] Stripe webhook secret set; endpoint uses HTTPS
- [ ] `FREELLMAPI_API_KEY` set if the gateway is public
- [ ] D1 backup taken
- [ ] `APP_ORIGIN` contains only the real frontend origin
- [ ] Rate limits reviewed
- [ ] Payment instructions filled (`PAYMENT_*`)
- [ ] At least two AI providers configured (one keyless)
