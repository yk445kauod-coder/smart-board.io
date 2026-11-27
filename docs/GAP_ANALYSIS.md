# Gap Analysis — from demo to a real SaaS

> Snapshot: 2026-11-27. The demo is a strong **product prototype**; it was not a
> business. This file separates what already works from what a paying school
> expects, and records what this phase added.

## 1. What the demo already had

| Area | Existing capability | Verdict |
| :--- | :--- | :--- |
| Board | Infinite canvas, pen, shapes, PDF export, themes, slides, offline snapshot | Strong |
| Protocol | Frozen v1 + extended ops, incremental scanner, validator, prompt builder | Strong, unusual advantage |
| AI | Multi-provider fallback (Cloudflare, OpenRouter, Pollinations, Gemini, offline) | Strong but frontend-only |
| Backend | Hono worker, D1 auth, lessons, SSE chat, rate limits | Good foundation |
| Bilingual | Arabic-first RTL, English mirror | Strong |
| Brand | Logo, tokens, fonts, palette, marketing copy | Strong |

## 2. What was missing for a real SaaS

### P0 — blocks revenue

1. **No workspace / tenant model.** Lessons belonged to a user, not a school. No seats, roles, or shared library.
2. **No plan enforcement.** `DAILY_CHAT_LIMIT` was one global env var. No lesson cap, no API-key cap, no upgrade path.
3. **No way to pay.** No card checkout, and — more important for Egypt — no InstaPay / cash wallet / bank transfer flow with activation codes.
4. **No public API contract.** Endpoints existed but there was no OpenAPI document, no API keys, no versioned developer surface.
5. **No MCP server.** Agents could not use the product; the protocol was trapped inside the web app.
6. **No operator console.** The founder could not see users, workspaces, usage, revenue, provider health, or payment requests.
7. **No audit trail.** Plan changes, suspensions, and key revocations were invisible.

### P1 — blocks trust and scale

8. **No org-scoped quota.** A school could exhaust a teacher's personal limit, or bypass it with a second account.
9. **No subscription state.** No `trialing`, `past_due`, `canceled`, period end, seats, or provider IDs.
10. **No docs site.** Developers had to read source.
11. **No provider health surface.** If Pollinations broke, nobody knew until a lesson failed.
12. **No generated-script sanitisation.** Models invent colours (`orange`) and the scanner drops the op.

### P2 — polish

13. **No pricing page inside the app.** The plan modal now covers this.
14. **No usage analytics.** Admin now shows daily AI turns and lesson counts.
15. **No co-founder role split.** Platform admin flag + audit log is the first step; granular roles come next.

## 3. What this phase added

| Gap | Implemented |
| :--- | :--- |
| Tenancy | `organizations`, `memberships`, `subscriptions`; personal workspace on registration |
| Roles | `owner`, `admin`, `teacher`, `viewer`; owner/admin gates for billing and keys |
| Plans | Free / Pro / School / Enterprise with seats, daily turns, lesson cap, API-key cap |
| Enforcement | Org-scoped daily chat quota, saved-lesson cap, API-key cap, 402 `upgrade:true` |
| Public API | `/v1/openapi.json`, `/docs`, API keys (`sb_live_…`, hashed, revocable, prefix display) |
| MCP | `/mcp` JSON-RPC: initialize, tools/list, tools/call with 7 tools |
| OmniRouter | Server-side `auto` model: FreeLLMAPI → premium → Workers AI → Pollinations → offline |
| Keyless AI | Pollinations keyless + Workers AI binding + deterministic offline protocol builder |
| FreeLLMAPI | OpenAI-compatible adapter via `FREELLMAPI_BASE_URL`; first in the chain when set |
| Payments | Stripe checkout/portal/webhook scaffolding **and** manual InstaPay / wallet / bank transfer |
| Activation codes | Hashed one-time codes, 30-day default, revocable, admin-generated or auto-issued on approval |
| Admin console | `/admin`: KPIs, MRR, workspaces, users, subscriptions, usage, providers, API keys, payments, codes, audit |
| Docs | `/docs` and this `docs/` folder |
| Billing UI | In-app `Plan & billing` modal: plans, manual payment, activation code, API keys |
| Audit | `audit_log` on register, login, lesson, key, billing, plan, user, code events |
| Sanitisation | Generated scripts normalise invented colours and `r` radius before validation |

## 4. Still missing (next 90 days)

| Priority | Item | Why it matters |
| :--- | :--- | :--- |
| P0 | Teacher invitations + seat enforcement on join | School plan currently creates seats but does not invite teachers |
| P0 | Stripe live keys + webhook secret in production | Card checkout is coded but disabled until configured |
| P0 | D1 backups + restore drill | A school's lesson library is business-critical |
| P1 | Usage-based AI cost tracking per org | Needed to price School/Enterprise safely |
| P1 | Password reset + email verification | Required for real signups |
| P1 | Rate limits per API key (not only per IP) | Prevent one key from exhausting a workspace |
| P1 | Content moderation / safety policy for student-facing output | Schools will ask |
| P2 | SSO / SCIM | Enterprise procurement |
| P2 | Arabic docs mirror | The primary market is Arabic-first |
| P2 | Export packs (PPTX / PDF bundle) | Pro feature promised in pricing |

## 5. Product judgement

The demo's unfair advantage is **the protocol**: a streamed, incrementally
validated drawing language. Most AI education tools generate text or slides.
SmartBoard draws on the board while the teacher is still talking. The SaaS work
should protect that advantage: keep the protocol stable, make it callable from
API/MCP, and charge for reliability, seats, and school-level controls — not for
the basic ability to draw.
