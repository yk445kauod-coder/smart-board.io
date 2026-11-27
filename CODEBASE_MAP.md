# SmartBoard AI — Codebase Map

> Quick, accurate orientation for anyone (human or agent) working in this repo.
> Snapshot: 2026-11-27 · branch `main` · commit `4f5f59a`.

---

## 1. TL;DR

- **What:** A client-side React whiteboard for teachers, with an AI "teacher" that emits structured board commands, plus PDF, chemistry, atlas, and classroom tools.
- **Stack:** Vite 6 + React 19 + TypeScript 5.8 + React Flow 11 + Tailwind (loaded from CDN, not built) + `perfect-freehand` + `pdfjs-dist` + `react-simple-maps` + `jspdf`/`html-to-image`.
- **Backend:** Two Cloudflare targets — Pages Functions (`functions/api/*`) and a standalone Worker (`worker-api.ts` → `smartboard-ai-api`). Both proxy AI/TTS providers and hide keys.
- **State:** 100% client-side, persisted in `localStorage`. No auth, no database, no accounts.
- **Status:** feature-rich demo. See `PROJECT_BRIEF.md` §13 for the honest gap list.

---

## 2. Runtime & tooling

| Item | Value |
| :--- | :--- |
| Node | 20+ (`.replit` pins `nodejs-20`) |
| Package manager | npm or pnpm (`pnpm-lock.yaml` + `package-lock.json` both committed) |
| Dev server | `npm run dev` → Vite on `:3000`; Replit runs `:5000` |
| Build | `npm run build` → `vite build` → `dist/` (measured: 1,019 kB JS / 315 kB gzip + 1,376 kB PDF worker; `dist` = 16 MB) |
| Type check | `npm run typecheck` → `tsc --noEmit` (passes, but `strict` is off) |
| Tests | `npm test` is **broken** (`pnpm` not installed); run `npm run test:data|ai|lab|toolkit|edge` individually — all pass |
| Deploy | `npm run deploy` → build + `wrangler pages deploy dist` |
| Install | `npm ci` **fails outside Replit** (13 lockfile URLs point to `package-firewall.replit.internal`) |

---

## 3. Boot flow

```text
index.html
  ├─ Tailwind CDN config + fonts + importmap (react, react-dom, @google/genai,
  │  reactflow, perfect-freehand from aistudiocdn.com)
  ├─ sets globalThis.__SMARTBOARD_API_BASE__ = https://smartboard-ai-api.yk445kauod.workers.dev
  └─ loads /index.tsx
        └─ createRoot(#root).render(<App />)
              └─ App: <ErrorBoundary><ReactFlowProvider><AppContent/></ReactFlowProvider></ErrorBoundary>
```

`App.tsx` is the orchestrator: it owns almost all state (board nodes/edges, slides, chat, PDF docs, settings, modals, undo/redo, persistence) and passes callbacks down. There is no router; views are a state machine: `home → language-select → board`.

---

## 4. Directory map

| Path | Role |
| :--- | :--- |
| `index.html` | Shell, Tailwind config, fonts, import map, API base global |
| `index.tsx` | React root |
| `App.tsx` (1060 L) | App state, handlers, view machine, render tree |
| `types.ts` (258 L) | **Single source of truth** for board element/action/persona types |
| `components/` | UI: board, toolbar, panels, modals, onboarding |
| `components/Board.tsx` (576 L) | React Flow canvas, pen/highlighter/eraser, smart-shape detection |
| `components/BoardElements.tsx` (957 L) | Renderers for every `ElementType` (note, table, mindmap, atlas, periodic…) |
| `components/BottomToolbar.tsx` | Tools, shapes, themes, classroom toolkit menu |
| `components/TopBar.tsx` | Lesson title, local-save badge, timer, export PDF, fullscreen |
| `components/AISheet.tsx` | AI Teacher chat sheet + lesson modes + mic |
| `components/PdfWorkspace.tsx` (587 L) | PDF render, pen/note annotations, page→board, ask AI |
| `components/SmartLabPanel.tsx` | Chemistry tabs (periodic, balancer, reactions, redox, materials) |
| `components/AtlasPanel.tsx` | react-simple-maps world/regions + Egypt SVG + pins |
| `components/StudentPickerModal.tsx` | Name wheel + draw mode |
| `components/GeometryToolsModal.tsx` (803 L) | Shape library + area/perimeter calculators |
| `components/ScientificCalcModal.tsx` | Calculator |
| `components/SlideRail.tsx` | Slides mode strip |
| `components/SmartOnboarding.tsx` | Language → teaching mode → name → topic → optional PDF |
| `components/HomeScreen.tsx` | Landing screen |
| `components/SettingsModal.tsx` | Persona, language, AI language, voice, TTS mode, personality |
| `components/ui.tsx` | `MButton`, `Sheet`, `IconBtn`, `ErrorBoundary` |
| `services/ai/assistant.ts` | Builds system/user prompts, routes mode, calls providers, applies commands |
| `services/ai/omnirouter/providers.ts` | Provider chain + command normalization + JSON extraction |
| `services/ai/omnirouter/boardSchema.ts` | Board size (1600×900), layout/routing hints |
| `services/ai/omnirouter/validate.ts` | Fence/JSON cleanup, plain-vs-board mode detection |
| `services/ai/omnirouter/offlineLesson.ts` | Deterministic offline lesson builder |
| `services/ai/vectorMemory.ts` | Hash-vector + cosine recall in `localStorage` (max 200) |
| `services/ai/searchGrounding.ts` | Tiny hard-coded "grounding" facts (water cycle, Pythagoras, …) |
| `services/knowledge.ts` | PDF text extraction (`pdfjs-dist`), chunking, local keyword index/RAG |
| `services/geminiService.ts` | Gemini TTS fetch + Pollinations image URL builder + request queue |
| `services/tts.ts` / `services/stt.ts` | Speech synthesis (Gemini→browser fallback) / Web Speech recognition |
| `data/periodic.ts` | 118 elements (ar/en names, mass, category) |
| `data/chemistry.ts` | Formula parser, equation balancer, reactions, activity series |
| `data/atlas.ts` | Region presets, world pins, Egypt governorates |
| `data/themes.ts` | Board themes (white/chalk/black/cream) |
| `functions/api/chat.ts` | Pages Function: POST /api/chat, CORS, provider loop, validation |
| `functions/api/tts.ts` | Pages Function: POST /api/tts |
| `worker-api.ts` + `wrangler-api.toml` | Standalone Worker `smartboard-ai-api` reusing the chat handler |
| `wrangler.toml` | Pages project `smartboard-eg`, `[ai] binding = "AI"` |
| `public/` | Logo, promos, atlas hero, PWA manifest, service worker, world map TopoJSON |
| `tests/` | tsx smoke/edge scripts (data, AI, lab, toolkit, live shape) |
| `PROJECT_BRIEF.md` | Vision, goal, BMC, value proposition, current-state honesty |
| `brand-assets/` | Curated copy of all media/logo/design tokens + brand guide |

---

## 5. Feature → code map

| Feature | Primary files |
| :--- | :--- |
| Infinite canvas, pan/zoom, undo/redo | `App.tsx` (history stacks), `components/Board.tsx` |
| Pen / highlighter / eraser / pressure | `components/Board.tsx` (`perfect-freehand`, `getStroke`) |
| Smart shapes (freehand → neat shape) | `components/Board.tsx` (`detectNeatShape`) |
| Notes/text/shapes/arrows/lines/equations/tables/code | `components/BoardElements.tsx`, `App.tsx` handlers |
| Mind maps / flowcharts / timelines / diagrams | `types.ts` graph shapes + `BoardElements.tsx` |
| Slides mode | `App.tsx` (`slides`, `loadSlide`, `switchBoardMode`), `components/SlideRail.tsx` |
| Themes | `data/themes.ts`, `BottomToolbar.tsx` |
| "Export PDF" button | `TopBar.tsx` → opens `PdfWorkspace`; **no PDF generation is implemented** (`jspdf`/`html-to-image` are unused deps) |
| Local autosave / project load | `App.tsx` (`localStorage`, `ProjectData` in `types.ts`) |
| AI Teacher chat + modes | `components/AISheet.tsx`, `services/ai/assistant.ts` |
| Board command application | `App.tsx` (`applyBoardCommands` / tool-call handler) |
| PDF open/annotate/send/ask | `components/PdfWorkspace.tsx`, `services/knowledge.ts` |
| Chemistry lab | `components/SmartLabPanel.tsx`, `data/periodic.ts`, `data/chemistry.ts` |
| Atlas | `components/AtlasPanel.tsx`, `data/atlas.ts`, `public/world-countries-110m.json` |
| Student picker | `components/StudentPickerModal.tsx` |
| Geometry tools | `components/GeometryToolsModal.tsx` |
| Calculator | `components/ScientificCalcModal.tsx` |
| TTS / STT | `services/tts.ts`, `services/stt.ts`, `functions/api/tts.ts` |
| PWA shell | `public/manifest.webmanifest`, `public/sw.js` |
| Error recovery | `components/ui.tsx` (`ErrorBoundary`) |

---

## 6. Board data model & persistence

- **Element contract:** `ElementData` + `ElementType` in `types.ts`. Nodes are React Flow nodes with `data: ElementData`.
- **AI contract:** `BoardAction` union in `types.ts` — the *only* allowed vocabulary between AI and renderer.
- **Board size assumption:** 1600×900 (`services/ai/omnirouter/boardSchema.ts`).
- **Persistence keys (localStorage):**
  - `smartboard_project_*` / project snapshot (see `ProjectData` usage in `App.tsx`)
  - `smartboard_vector_memory` (max 200 entries)
  - `smartboard_student_list_v2`
  - board prefs (theme/shape) and custom subjects
- **No server persistence.** Clearing browser storage clears the lesson.

---

## 7. AI pipeline (end to end)

```text
AISheet (user prompt, mode)
  └─ App.submitPromptToAI
       └─ services/ai/assistant.buildAssistant*   // system + user prompt, mode hints,
       │                                          //   knowledge context, vector memory
       ├─ POST /api/chat  (same-origin)  ── or ── POST ${__SMARTBOARD_API_BASE__}/api/chat
       │    └─ functions/api/chat.ts
       │         ├─ exposes env.AI binding as globalThis.__SMARTBOARD_AI__
       │         ├─ copies env keys into process.env
       │         └─ provider loop with 15s timeout:
       │              cloudflare (Workers AI) → gemini → openrouter
       │              (plain modes may also use pollinations; offline excluded server-side)
       ├─ client-side fallback providers if the server route fails
       └─ textToBoardCommands(text)
            ├─ cleanupJsonMarkers / extractJsonArray
            ├─ normalizeBoardCommand (aliases: create_note→addNote, …)
            └─ allow-list filter (addNote, addMindMap, update, remove, …)
                 └─ layoutCommands (place on 1600×900)
                      └─ App applies actions to React Flow nodes
```

**Providers** (`services/ai/omnirouter/providers.ts`):

| id | Model / endpoint | Notes |
| :--- | :--- | :--- |
| `cloudflare` | Workers AI `@cf/zai-org/glm-4.7-flash` (plain) / `@cf/meta/llama-3.1-8b-fast-v2` (board) | Primary; uses `AI` binding or REST |
| `gemini` | `gemini-2.5-pro` via Google AI Studio | Optional key; Google Search tool |
| `openrouter` | `openrouter/free` | JSON mode for board modes |
| `pollinations` | `text.pollinations.ai` | Free fallback, long timeout |
| `offline` | deterministic builder | Zero network; always works (client-side) |

**Images:** `generateImageWithPollinations()` builds a Pollinations image URL (no key).

**Validation:** `validate.ts` + `normalizeBoardCommand` are the safety layer. If a provider returns prose or invalid commands in a board mode, the server rejects it and tries the next provider.

**Three important gaps (verified):**
- `buildUserPrompt` never reads `req.context`, so `selectedElements`, `boardSummary`, `pdfText`, and `pdfPages` are computed but **never sent to the model**. The `arrange` mode is therefore not functional.
- The `offline` provider is unreachable: the server explicitly skips it, and the client never calls `PROVIDERS` (it only uses `textToBoardCommands`). AI always needs network.
- `storeMemory` is imported but never called, so `smartboard_vector_memory` is never written.

---

## 8. Backend routes

| Route | File | Behavior |
| :--- | :--- | :--- |
| `POST /api/chat` | `functions/api/chat.ts` | Validates `{ req, system, user }`, injects env, loops providers, returns `{ text, model, provider }` |
| `OPTIONS /api/chat` | same | CORS 204 (`Access-Control-Allow-Origin: *`) |
| `POST /api/tts` | `functions/api/tts.ts` | Gemini TTS proxy, returns base64 `audioData` |
| Worker `smartboard-ai-api` | `worker-api.ts` | Same chat handler on a standalone Worker |

**Env vars** (never commit): `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `OPENROUTER_API_KEY`, `POLLINATIONS_API_KEY`, `GEMINI_API_KEY` (see `.env.example`).

---

## 9. Styling & design system

- Tailwind is loaded from `cdn.tailwindcss.com` with an inline config in `index.html`. **Not** part of the build.
- Key tokens (duplicated across `index.html`, components, and docs — see drift note):
  - `cosmic-dark` `#080D1E`, `toolbar` `#080D1E`
  - `orbital-cyan` / `accent` `#00E5FF`, `starlight-amber` `#F59E0B`, `magenta` `#D946EF`
  - `primary` `#059669`, `secondary` `#10b981` (legacy emerald still used in components)
  - Board themes: white / cream / chalk / black
- Fonts (Google Fonts): IBM Plex Sans Arabic, Cairo, El Messiri, Space Grotesk, Inter, Kalam, Playpen Sans Arabic.
- Icons: Material Symbols Rounded + Font Awesome.
- `brand-assets/BRAND.md` documents the intended identity; the code still mixes emerald and cyan.

---

## 10. Build / test / deploy

```bash
npm install
npm run dev          # http://localhost:3000
npm run typecheck
npm test             # data + ai + lab + toolkit + edge
npm run build        # dist/
npm run deploy       # build + wrangler pages deploy dist
```

- Pages project: **`smartboard-eg`** (`wrangler.toml`, output `dist`).
- Worker project: **`smartboard-ai-api`** (`wrangler-api.toml`, `worker-api.ts`).
- `index.html` hard-codes the Worker URL as the API base, so the frontend can call AI even when served from Pages without Functions.
- Tests are standalone `tsx` scripts that print `ok/FAIL`; there is no Jest/Vitest runner. `tests/dom-shims.ts` provides browser shims.

---

## 11. Known issues / tech debt (priority order)

1. **No auth, no multi-tenancy, no server storage** — everything is per-browser `localStorage`.
2. **XSS via board content** — AI/PDF text reaches 9 `dangerouslySetInnerHTML` sites unsanitized (`lib/sanitize.ts` is only used for chat). Full chain in `TECH_STACK_ARCHITECTURE.md` §6.3.
3. **AI reliability + missing context** — free/rate-limited providers; `req.context` (selection, board summary, PDF text) is never sent to the model, so `arrange`/"edit selection" cannot work.
4. **Open API** — `/api/chat` and `/api/tts` use `Access-Control-Allow-Origin: *` with no auth, rate limit, or request-size cap.
5. **Persistence design** — full PDF text and page images (data URLs) in `localStorage`; autosave and undo stringify the whole board on every change (no debounce) → quota failures + jank.
6. **CDN dependency** — Tailwind (runtime), import map, fonts, icons, and React Flow CSS from 5 external sources; first load needs network despite the "Offline-ready" label.
7. **Bundle/assets** — single 1,019 kB JS chunk, 1,376 kB PDF worker, `dist` = 16 MB; two promo PNGs (7.1 MB) ship without being used; no code-splitting/lazy loading.
8. **Reproducibility** — `npm ci` fails outside Replit (13 lockfile URLs), both npm and pnpm lockfiles committed, `npm test` requires pnpm.
9. **Dead code/deps** — `Chat.tsx` and `Onboarding.tsx` imported but never rendered; `EditNodeModal.tsx` empty; unused `@google/genai`, `jspdf`, `html-to-image`, `topojson-client`, `world-atlas`; dead `AICacheEntry`, `defaultPosition`, `storeMemory` call, `toolbarPosition`/`isToolbarHidden`/`lessonDetail` state.
10. **Brand drift** — emerald `#059669` vs cyan `#00E5FF`; docs disagree (see `PROJECT_DNA.md` vs `COMMITTEE_RESULTS.md`).
11. **Accessibility** — ARIA present in places, but no audit; `user-scalable=no` blocks zoom.
12. **Privacy** — student names in `localStorage`, no consent/retention policy.

---

## 12. Where to start for common tasks

| Task | Start here |
| :--- | :--- |
| Add a new board element type | `types.ts` (`ElementType`, `ElementData`, `BoardAction`) → `BoardElements.tsx` → `App.tsx` apply logic → prompt hints in `boardSchema.ts`/`assistant.ts` |
| Add/modify an AI lesson mode | `types.ts` (`LessonMode`) → `services/ai/assistant.ts` (`MODE_HINT`) → `components/AISheet.tsx` |
| Change AI providers | `services/ai/omnirouter/providers.ts` + `functions/api/chat.ts` |
| Change the PDF flow | `components/PdfWorkspace.tsx` + `services/knowledge.ts` |
| Add chemistry content | `data/chemistry.ts` + `data/periodic.ts` + `SmartLabPanel.tsx` |
| Change branding | `index.html` (Tailwind config/fonts) + `brand-assets/` + `public/*.png` |
| Change deploy target | `wrangler.toml`, `wrangler-api.toml`, `package.json` scripts |

---

---

## 13. SaaS layer added 2026-11-27

The original map above describes the client demo. A separate worker now provides
the business layer.

### Worker (`worker/src/`)

| File | Role |
| :--- | :--- |
| `index.ts` | Hono app: `/auth/*`, `/v1/*`, `/admin`, `/docs`, `/mcp`, `/health` |
| `db.ts` | D1 helpers, schema guards, audit |
| `auth.ts` | PBKDF2 passwords, sessions, `requireAuth`, `requireOrg`, `requireRole`, `requirePlatformAdmin` |
| `orgs.ts` | Organizations, memberships, subscriptions, API keys |
| `plans.ts` | Free / Pro / School / Enterprise, quotas, `planTier` |
| `omni.ts` | Plan-aware provider chain + deterministic offline lesson builder |
| `providers.ts` | Provider adapters (OpenRouter, Gemini, Anthropic, DeepSeek, Pollinations, Workers AI, FreeLLMAPI) |
| `models.ts` | Model registry and availability |
| `sanitize.ts` | Coerces invented colours/radii before protocol validation |
| `admin.ts` / `admin-ui.ts` / `admin.html` | Platform console API + UI |
| `billing.ts` | Stripe checkout/portal/webhook + plan sync |
| `manual.ts` | InstaPay/wallet/bank requests + activation codes |
| `mcp.ts` | JSON-RPC MCP server, 7 tools |
| `openapi.ts` | OpenAPI 3.1 document |
| `docs.html` / `docs-ui.ts` | Developer docs UI |

### Migrations

`0001_init.sql` → `0002_rate_limits.sql` → `0003_saas.sql` (orgs, memberships,
subscriptions, API keys, audit, org_id backfill) → `0004_manual_payments.sql`
(payment requests, activation codes, redemptions).

### Frontend SaaS surface

- `components/BillingModal.tsx` — plans, manual payment, activation code, API keys, inline auth.
- `components/TopBar.tsx` — `Plan` button.
- `src/api/client.ts` — typed billing, API-key, and auth methods.
- `App.tsx` — owns `isBillingOpen` and renders the modal.

### Docs

`docs/GAP_ANALYSIS.md`, `SYSTEM_DESIGN.md`, `DESIGN_SYSTEM.md`, `SAAS_MODEL.md`,
`API.md`, `MCP.md`, `OMNIROUTER.md`, `ADMIN.md`, `OPERATIONS.md`.

### Test accounts (local)

- Platform admin: `founder@smartboard.test` / `change-me-123` (flag set), org `founder-bc6ca8`.
- Allowlist default: `teacher@example.com`.
- Admin page: `http://localhost:8787/admin`; docs: `/docs`.

*Keep this map short. If a detail will be stale in a month, put it in the code or in `PROJECT_BRIEF.md`, not here.*
