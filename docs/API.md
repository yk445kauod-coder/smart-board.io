# SmartBoard AI — API Reference

Base URL in development: `http://localhost:8787`
Base URL in production: your worker origin (for example `https://api.smartboard.ai`)
Machine-readable spec: `GET /v1/openapi.json` (OpenAPI 3.1).

## Authentication

### Browser session

`POST /auth/register` and `POST /auth/login` set an HttpOnly `sb_session` cookie.
Use `credentials: 'include'` in the browser.

### API key

```http
Authorization: Bearer sb_live_...
```

or

```http
x-api-key: sb_live_...
```

Keys are created with `POST /v1/api-keys`, shown once, hashed at rest, and can be
revoked with `DELETE /v1/api-keys/:id`.

### Workspace selection

A user can belong to multiple workspaces. The default is the first active
membership (owner first). Override with:

```http
x-org-id: <organization id>
```

The header is validated against the user's membership.

## Common headers

| Header | Direction | Meaning |
| :--- | :--- | :--- |
| `x-request-id` | response | Unique request id; include in bug reports |
| `x-org-id` | request | Active workspace |
| `Authorization` | request | `Bearer sb_live_...` |
| `Content-Type` | request | Must be `application/json` for JSON bodies |

## Auth

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| POST | `/auth/register` | — | Create user + personal workspace + free subscription |
| POST | `/auth/login` | — | Set session cookie |
| POST | `/auth/logout` | cookie | Delete session |
| GET | `/auth/me` | yes | User, org, plan, subscription, auth kind |

```bash
curl -X POST http://localhost:8787/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"teacher@example.com","password":"change-me-123","name":"Teacher"}'
```

## Lessons

All lesson routes are scoped to the active workspace (`org_id`).

| Method | Path | Description |
| :--- | :--- | :--- |
| GET | `/v1/lessons` | List latest 100 lessons |
| POST | `/v1/lessons` | Validate and save a protocol script |
| GET | `/v1/lessons/:id` | Load a lesson |
| PUT | `/v1/lessons/:id` | Update title, lang, or script |
| DELETE | `/v1/lessons/:id` | Delete a lesson |

```json
{
  "title": "Fractions with pizza",
  "lang": "en",
  "script": {
    "title": "Fractions",
    "lang": "en",
    "steps": [
      { "title": "Intro", "say": "One whole pizza.", "ops": [
        { "op": "write", "id": "title", "x": 800, "y": 60, "text": "Fractions", "size": 56, "anchor": "middle" }
      ] }
    ]
  }
}
```

Validation errors return `400` with the first five messages. A Free workspace
that reaches 30 saved lessons gets `402` with `upgrade: true`.

## Streaming chat

`POST /v1/chat/stream`

```json
{
  "model": "auto",
  "messages": [{ "role": "user", "content": "Teach the water cycle" }],
  "mode": "lesson",
  "lang": "en",
  "extended": true,
  "maxTokens": 6000
}
```

`model: "auto"` uses OmniRouter. A concrete model id (see `GET /v1/models`)
pins one provider and fails fast if its key is missing.

SSE events:

| Event | Data |
| :--- | :--- |
| `meta` | `{ requestId, model, plan }` |
| `provider` | `{ provider, model }` when auto picks a provider |
| `delta` | `{ text }` |
| `op` | `{ op }` a validated protocol op |
| `step` | `{ count }` |
| `warning` | `{ errors: string[] }` |
| `done` | `{ requestId, chars, ops, steps, provider, model }` |
| `error` | `{ requestId, message }` |

The server counts each request against the workspace daily quota before
streaming. A quota miss returns `429`.

## API keys

| Method | Path | Role | Description |
| :--- | :--- | :--- | :--- |
| GET | `/v1/api-keys` | any member | List keys (prefix only) |
| POST | `/v1/api-keys` | owner/admin | Create key; raw key returned once |
| DELETE | `/v1/api-keys/:id` | owner/admin | Revoke key |

```bash
curl -X POST http://localhost:8787/v1/api-keys \
  -H 'Authorization: Bearer sb_live_...' \
  -H 'Content-Type: application/json' \
  -d '{"name":"Cursor","scopes":"read,write"}'
```

## Billing

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| GET | `/v1/billing/plans` | — | Public plan catalogue |
| GET | `/v1/billing/config` | — | Stripe configured? |
| GET | `/v1/billing/subscription` | yes | Current subscription |
| POST | `/v1/billing/checkout` | owner/admin | Stripe Checkout URL |
| POST | `/v1/billing/portal` | owner/admin | Stripe billing portal URL |
| POST | `/v1/billing/webhook` | Stripe signature | Subscription sync |
| GET | `/v1/billing/manual-instructions` | — | InstaPay / wallet / bank details |
| POST | `/v1/billing/manual-request` | owner/admin | Submit a transfer reference |
| GET | `/v1/billing/manual-requests` | yes | Own workspace requests |
| POST | `/v1/billing/redeem` | owner/admin | Redeem an activation code |

```bash
curl -X POST http://localhost:8787/v1/billing/manual-request \
  -H 'Authorization: Bearer sb_live_...' \
  -H 'Content-Type: application/json' \
  -d '{"plan":"pro","method":"instapay","reference":"INV-12345"}'
```

## Push notifications

| Method | Path | Role | Purpose |
| :--- | :--- | :--- | :--- |
| GET | `/v1/push/public-key` | — | VAPID public key + `configured` flag |
| POST | `/v1/push/subscribe` | yes | Store a browser push subscription |
| DELETE | `/v1/push/subscribe` | yes | Revoke a subscription by endpoint |
| POST | `/v1/push/test` | yes | Send a test notification to this user |

Subscriptions are scoped to the caller's `org_id` and `user_id`. Endpoints must be
HTTPS and belong to a known push service. See [`PUSH.md`](PUSH.md).

## Admin (platform)

Requires a platform admin (`users.is_platform_admin = 1` or an email in
`PLATFORM_ADMIN_EMAILS`).

| Method | Path | Description |
| :--- | :--- | :--- |
| GET | `/v1/admin/overview` | Users, orgs, paid subs, MRR, chats, lessons |
| GET | `/v1/admin/users?q=` | Users with org/plan/role |
| GET | `/v1/admin/orgs?q=` | Workspaces with owner, seats, lessons |
| PATCH | `/v1/admin/orgs/:id` | Change plan/status/seats |
| GET | `/v1/admin/subscriptions` | Subscription list |
| GET | `/v1/admin/usage?days=30` | Daily usage |
| GET | `/v1/admin/providers` | OmniRouter provider health |
| GET | `/v1/admin/api-keys` | All keys |
| DELETE | `/v1/admin/api-keys/:id` | Revoke any key |
| GET | `/v1/admin/payment-requests` | Manual payment queue |
| POST | `/v1/admin/payment-requests/:id/approve` | Issue activation code |
| POST | `/v1/admin/payment-requests/:id/reject` | Reject request |
| GET | `/v1/admin/activation-codes` | Code list (prefix only) |
| POST | `/v1/admin/activation-codes` | Create code |
| POST | `/v1/admin/activation-codes/:id/revoke` | Revoke code |
| GET | `/v1/admin/audit?limit=100` | Audit log |

## Health and discovery

| Method | Path | Description |
| :--- | :--- | :--- |
| GET | `/health` | `{ok, db, ts, version}` |
| GET | `/` | Service links |
| GET | `/v1/models` | Models + provider availability |
| GET | `/v1/providers` | Provider availability |
| GET | `/v1/openapi.json` | OpenAPI 3.1 |
| GET | `/docs` | HTML docs |
| GET | `/admin` | HTML admin console |
| GET | `/mcp` | MCP metadata (auth required) |
| POST | `/mcp` | MCP JSON-RPC |

## Errors

```json
{ "error": "The Free plan allows 30 saved lessons", "upgrade": true, "requestId": "…" }
```

| Status | Meaning |
| :--- | :--- |
| 400 | Validation error |
| 401 | Missing/invalid session or API key |
| 402 | Plan limit; `upgrade: true` |
| 403 | Wrong workspace, role, or suspended account |
| 404 | Not found |
| 409 | Email already registered |
| 413 | Body too large |
| 415 | Not JSON |
| 429 | Rate limited or daily quota |
| 502/503 | Provider or billing unavailable |
