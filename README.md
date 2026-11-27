# SmartBoard AI

SmartBoard AI is a bilingual (Arabic/English) classroom whiteboard for teachers. It combines a clean infinite canvas with an AI teacher, PDF notes, an interactive atlas, a chemistry lab, and practical classroom tools.

The project is a Vite + React + TypeScript app. It keeps the board and preferences in the browser so a lesson can continue working locally even when the network is unavailable.

## What is included

- **Interactive whiteboard** — pen, highlighter, eraser, text, notes, shapes, arrows, undo/redo, slides, themes, and PDF export.
- **Protocol Studio** — an AI teacher that streams a JSON drawing protocol onto the board, saves lessons to D1, and exports SVG/PNG/JSON. Open it at `/?protocol=1` or from the board toolbar.
- **AI Teacher** — creates board content, explains topics, summarizes, translates, asks practice questions, and uses selected board/PDF context.
- **PDF workspace** — reads PDF or text material, supports annotations, and sends pages to the board.
- **Smart Lab** — periodic table, formula parsing, reaction balancing, reactivity checks, and chemistry presets.
- **Interactive Atlas** — world, regional, Middle East, and Egypt views with map pins.
- **Classroom toolkit** — student picker, geometry tools, scientific calculator, lesson timer, fullscreen mode, and Arabic RTL support.

## SaaS platform (new)

SmartBoard is now a multi-tenant SaaS, not only a demo:

- **Workspaces, roles, plans** — Free / Pro / School / Enterprise with seats, daily AI turns, lesson caps, and API-key caps.
- **Manual payments for Egypt** — InstaPay, cash wallet, or bank transfer. The founder approves the transfer in `/admin` and issues a one-time activation code; the teacher redeems it in the app.
- **Public API + MCP** — OpenAPI 3.1 at `/v1/openapi.json`, API keys (`sb_live_…`), and an MCP server at `/mcp`.
- **OmniRouter** — `model: "auto"` routes across FreeLLMAPI, OpenRouter, Gemini, Anthropic, DeepSeek, Workers AI, and keyless Pollinations, with a deterministic offline fallback.
- **Platform console** — `/admin` for users, workspaces, subscriptions, usage, providers, API keys, payment requests, activation codes, and audit.
- **Developer docs** — `/docs` in the worker and `docs/` in the repo.
- **Web Push** — zero-budget VAPID notifications (no FCM account); see `docs/PUSH.md`.
- **Tenant isolation** — every tenant query is org-scoped; see `docs/RLS.md`.
- **In-app billing** — the **Plan** button in the top bar opens plans, manual payment, activation, and API-key management.

Start here:

| Doc | What it covers |
| :--- | :--- |
| [`docs/GAP_ANALYSIS.md`](docs/GAP_ANALYSIS.md) | What was missing and what this phase added |
| [`docs/SYSTEM_DESIGN.md`](docs/SYSTEM_DESIGN.md) | Architecture, data model, flows, security |
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) | Tokens, type, components, RTL, accessibility |
| [`docs/SAAS_MODEL.md`](docs/SAAS_MODEL.md) | Pricing, unit economics, GTM, metrics |
| [`docs/API.md`](docs/API.md) | Endpoints, auth, SSE, errors |
| [`docs/MCP.md`](docs/MCP.md) | MCP tools and client setup |
| [`docs/OMNIROUTER.md`](docs/OMNIROUTER.md) | Provider chain, keyless providers, FreeLLMAPI |
| [`docs/ADMIN.md`](docs/ADMIN.md) | Platform console and manual payment runbook |
| [`docs/OPERATIONS.md`](docs/OPERATIONS.md) | Env vars, migrations, deploy, incidents |
| [`docs/RLS.md`](docs/RLS.md) | D1 tenant isolation (application-level row security) |
| [`docs/PUSH.md`](docs/PUSH.md) | Zero-budget Web Push (VAPID) setup and limits |

## Run locally

Requirements:

- Node.js 20 or newer
- npm

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

The app opens on the port printed by Vite. The Replit workflow runs it on port `5000` for the preview.

## Backend: Cloudflare Worker + D1

The authenticated API and lesson storage live in `worker/` (Hono + Cloudflare Workers + D1). The protocol types, scanner, validator, and prompt builder in `src/protocol/` are shared by the Worker and the frontend.

Local development:

```bash
cp worker/.dev.vars.example worker/.dev.vars   # add provider keys
npm run db:migrate:local
npm run worker:dev                             # http://localhost:8787
npm run dev                                    # http://localhost:3000
```

Vite proxies `/api/*` to the Worker in development, so the frontend uses same-origin cookies and no CORS setup is needed. Open `http://localhost:3000/?protocol=1` for Protocol Studio.

API surface:

```text
GET  /health                 service + D1 health
GET  /v1/openapi.json        OpenAPI 3.1
GET  /docs                   developer docs
GET  /admin                  platform console
POST /auth/register          create account, workspace, free plan
POST /auth/login             sign in
POST /auth/logout            clear session
GET  /auth/me                user, workspace, plan
GET  /v1/models              models + provider availability
GET  /v1/lessons             list workspace lessons
POST /v1/lessons             save a validated protocol script
GET  /v1/lessons/:id         load one lesson
PUT  /v1/lessons/:id         replace a lesson
DELETE /v1/lessons/:id       delete a lesson
POST /v1/chat/stream         SSE stream; model "auto" uses OmniRouter
GET  /v1/api-keys            list keys
POST /v1/api-keys            create key (raw key shown once)
DELETE /v1/api-keys/:id      revoke key
GET  /v1/billing/plans       public plans
POST /v1/billing/manual-request  submit InstaPay/wallet/bank reference
POST /v1/billing/redeem      redeem an activation code
GET  /v1/admin/*             platform admin (KPIs, orgs, payments, audit)
POST /mcp                    MCP JSON-RPC (initialize, tools/list, tools/call)
```

Production setup:

```bash
wrangler d1 create smartboard
# Put the returned database_id into worker/wrangler.toml.
npm run db:migrate:remote
wrangler secret put OPENROUTER_API_KEY --config worker/wrangler.toml
# Repeat for GEMINI_API_KEY, DEEPSEEK_API_KEY, ANTHROPIC_API_KEY as needed.
# Optional: FREELLMAPI_BASE_URL + FREELLMAPI_API_KEY, STRIPE_*.
npm run worker:deploy
```

The app works with **zero AI keys**: OmniRouter falls back to keyless
Pollinations, the Workers AI binding, and a deterministic offline lesson
builder. See [`docs/OMNIROUTER.md`](docs/OMNIROUTER.md).

Set `APP_ORIGIN` in `worker/wrangler.toml` to the frontend origin (comma-separated list is supported). For a separate frontend origin, build with `VITE_API_BASE=https://<worker-host>` and set `COOKIE_SECURE="true"` and `COOKIE_SAMESITE="None"`. For a same-site deployment, `Lax` is enough. `AUTH_RATE_LIMIT`, `REGISTER_RATE_LIMIT`, and `DAILY_CHAT_LIMIT` are tunable per deployment.

## Verify the project

Run the production build:

```bash
npm run build
```

Run the type checker:

```bash
npm run typecheck
```

Run all smoke and edge-case tests:

```bash
npm test
```

Individual checks are also available:

```bash
npm run test:data
npm run test:ai
npm run test:lab
npm run test:toolkit
npm run test:edge
```

## AI and speech services

The whiteboard, local persistence, chemistry tools, atlas, calculator, and PDF UI can be explored without API keys.

AI and server-side text-to-speech use the existing API routes in `functions/api/`. Configure provider secrets in the runtime environment, never in committed files:

```text
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
OPENROUTER_API_KEY=
POLLINATIONS_API_KEY=
GEMINI_API_KEY=
```

`.env.example` lists the supported variable names. The frontend does not need a `.env` file for the basic board experience.

## Project layout

```text
App.tsx                 Main application state and board orchestration
components/             Whiteboard, onboarding, panels, dialogs, and toolbar
data/                   Periodic table, chemistry, atlas, and theme data
services/               AI routing, PDF/RAG, speech, and image services
src/protocol/           Shared protocol types, scanner, validator, prompt
src/api/                Typed frontend client and SSE parser
worker/                 Hono API, D1 migrations, Worker configuration
worker/src/admin.html   Platform console UI (served at /admin)
worker/src/docs.html    Developer docs UI (served at /docs)
worker/src/omni.ts      OmniRouter + offline protocol builder
worker/src/manual.ts    Manual payments + activation codes
functions/api/          Legacy Pages API routes for chat and TTS
tests/                  Data, AI command, chemistry, protocol, and auth tests
public/                 Logo, map data, PWA metadata, and static assets
```

## Deployment

The existing deployment target is Cloudflare Pages:

```bash
npm run deploy
```

Before deploying, add the required Cloudflare and AI secrets to the deployment environment. Do not commit `.env`, API keys, or generated build output.

## Design notes

- Arabic is supported as a first-class RTL interface, while the AI language can be configured independently.
- The board has white, cream, chalkboard, and black themes.
- Lesson content is stored locally in the browser for the main board. Protocol Studio lessons are also saved to D1 for signed-in users; clearing browser storage does not delete D1 lessons.
- PDF parsing uses `pdfjs-dist` 4.x to remain compatible with the project's Node 20 runtime.