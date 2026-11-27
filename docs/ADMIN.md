# Platform Admin Console

Open `/admin` on the worker origin (for example `http://localhost:8787/admin`).

## Access

A session is a platform admin if either:

1. `users.is_platform_admin = 1`, or
2. the user's email is in `PLATFORM_ADMIN_EMAILS` (comma-separated).

Local default: `PLATFORM_ADMIN_EMAILS = "teacher@example.com"`.
To promote another account:

```bash
wrangler d1 execute smartboard --local --config worker/wrangler.toml \
  --command "UPDATE users SET is_platform_admin = 1 WHERE email = 'founder@example.com'"
```

The console is served by the worker, so it uses the same-origin `sb_session`
cookie and needs no CORS configuration.

## Screens

| Screen | What it answers |
| :--- | :--- |
| **Overview** | Users, workspaces, paid subscriptions, MRR/ARR, AI turns today, lessons, plan mix, recent audit |
| **Workspaces** | Every org, owner, plan, status, members, lessons, keys; change plan or suspend |
| **Users** | Email, name, workspace, role, plan, status; suspend/activate |
| **Subscriptions** | Plan, status, seats, provider, period end |
| **Usage** | AI turns per day for the last 30 days, breakdown by kind |
| **AI providers** | OmniRouter registry: configured, keyless, FreeLLMAPI, per-model availability |
| **API keys** | All keys, prefix, owner, workspace, last use; revoke |
| **Payments** | Manual InstaPay / wallet / bank requests; approve & issue code, reject |
| **Activation codes** | Prefix, plan, seats, days, uses, status; generate or revoke |
| **Audit log** | Who changed what, when, with metadata |

## Manual payment runbook

1. Teacher submits a request in the app: plan, method, reference, note.
2. Open **Payments**; confirm the reference and amount against the actual
   transfer.
3. Click **Approve & issue code**. A one-time code appears in a prompt.
4. Send the code to the teacher on WhatsApp.
5. The teacher opens **Plan → Pay & activate**, enters the code, and the
   workspace is upgraded for 30 days.
6. If the transfer is fake or duplicated, click **Reject** and record the reason.

**Never** issue a code before confirming the money. Approval writes an audit
event with the operator, request id, plan, and code id.

## Plan overrides

Use **Workspaces → Plan** to set free/pro/school/enterprise manually. This is
intended for:

- design partners and pilots,
- enterprise contracts paid by invoice,
- fixing a failed Stripe webhook.

Every override writes a `manual` subscription and an audit event.

## Suspension

Suspending an org sets `organizations.status = 'suspended'`. Its members can
still sign in but cannot resolve an active workspace; API keys fail with 403.
Suspending a user blocks login and API key use.

## What the console does not do yet

- Invite teachers or manage seats.
- Refund a payment.
- Edit a lesson.
- Impersonate a user (deliberate: use audit + support).
- Delete an org (deliberate: soft suspend first).
