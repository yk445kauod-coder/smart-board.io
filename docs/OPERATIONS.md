# Operations Runbook

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
| `APP_ORIGIN` | `http://localhost:3000` | CORS allowlist (comma-separated) |
| `PUBLIC_APP_URL` | `http://localhost:3000` | Stripe success/cancel redirects |
| `COOKIE_SECURE` | `false` local, `true` prod | Secure cookie flag |
| `COOKIE_SAMESITE` | `Lax` local, `None` prod for cross-site | Cookie policy |
| `SESSION_DAYS` | `30` | Session lifetime |
| `DAILY_CHAT_LIMIT` | `50` | Overrides plan daily chats for all plans (testing) |
| `AUTH_RATE_LIMIT` | `60` | Login attempts per 15 min per IP |
| `REGISTER_RATE_LIMIT` | `10` | Registrations per hour per IP |
| `PLATFORM_ADMIN_EMAILS` | `teacher@example.com` | Founder allowlist |
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

## Deploy

```bash
# 1. D1 (always before the worker code that uses it)
wrangler d1 migrations apply smartboard --remote --config worker/wrangler.toml

# 2. worker (production origins + cross-site cookies)
wrangler deploy --config worker/wrangler.toml \
  --var APP_ORIGIN:https://smartboard-eg.pages.dev \
  --var PUBLIC_APP_URL:https://smartboard-eg.pages.dev \
  --var COOKIE_SECURE:true \
  --var COOKIE_SAMESITE:None

# 3. frontend (point it at the worker origin)
VITE_API_BASE=https://smartboard-api.<account>.workers.dev npm run build
npx wrangler pages deploy dist --project-name smartboard-eg
```

`smartboard-eg` is the Pages project; `smartboard-api` is the Worker. Both need
`CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` when running non-interactively.

Set `VITE_API_BASE` in the Pages build environment to the worker origin. The
worker must allow the Pages origin in `APP_ORIGIN` and use `COOKIE_SECURE=true`,
`COOKIE_SAMESITE=None` for cross-site cookies.

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
| Login 401 after register | Cookie blocked by cross-site policy | Set `COOKIE_SAMESITE=None`, `COOKIE_SECURE=true`, use HTTPS |
| Stream 503 | Concrete model key missing | Use `auto` or configure the key |
| Every stream falls to offline | Pollinations/Workers AI down | Check `/v1/providers`; configure OpenRouter/Gemini |
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
