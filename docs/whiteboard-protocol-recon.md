# Whiteboard protocol — technical recon (for the SmartBoard AI migration)

> **Status:** research note, not an approved design. Written 2026-11-27 while evaluating
> `molly554/whiteboard-ai-tutor` (MIT, v0.4.0) as a replacement for our React Flow board engine.
> No product code has been changed.

---

## 1. What the reference actually is

| Part | What it does | Portability |
| :--- | :--- | :--- |
| `protocol/PROTOCOL.md` | Frozen system prompt (Chinese; English translation alongside). Defines a JSON script of `steps` and drawing `ops`. | Copy/adapt as prompt template |
| `player/index.html` (742 lines, vanilla JS) | Replays a recorded script as animated SVG handwriting. No build step. | **Must be ported/embedded** — not a library |
| `bench/` (Python) | Generates scripts by streaming from OpenRouter / Anthropic / Gemini / DeepSeek, validates, scores, renders boards. | Blueprint for our server-side gateway |
| `scenarios/` + `results/` | 8 scenarios, 288 runs, 64 blind-reviewed boards. | Useful as an eval corpus |

**Key point:** it is a *replay player + benchmark*, not a live tutoring app. There is no backend,
no auth, no persistence, and no live generation UI. “Merging” means adopting the protocol and
re-implementing the generation + playback loop in our stack.

---

## 2. The protocol (frozen v1)

Board: **1600 × 900**, origin top-left, x→right, y→down, ≥40 margin.

```json
{
  "title": "short title",
  "lang": "en",
  "steps": [
    {
      "title": "step title",
      "say": "1–2 sentences of narration",
      "ops": [ { "op": "write", "id": "k1", "x": 60, "y": 128, "text": "Hello", "size": 36 } ]
    }
  ]
}
```

- 5–8 steps, ≤12 ops per step, one idea per step.
- Every object has a globally unique `id`; `erase`/edits refer to it.
- Narration must match what the step draws.

| op | Fields | Notes |
| :--- | :--- | :--- |
| `write` | `id, x, y, text, size?=40, color?, anchor?=start\|middle, underline?` | top-left of text box; `\n` allowed |
| `line` | `id, x1,y1,x2,y2, color?, width?=5, arrow?=false\|true\|"both", dash?` | |
| `rect` | `id, x,y,w,h, color?, width?, fill?` | |
| `ellipse` | `id, cx,cy,rx,ry, rotate?, color?, width?, fill?` | |
| `path` | `id, d, color?, width?, fill?, arrow?, dash?` | absolute SVG path commands |
| `erase` | `ids:[...]` or `region:{x,y,w,h}` or `all:true` | exactly one of the three |

Colours: `ink`, `blue`, `red`, `green`, `gray`. Sizes: body 36–44, labels 28–34, titles 52–60,
never below 24.

**Interruption input** (`mode: "continue"`):

```json
{ "mode": "continue", "question": "...", "board": { "atStep": 3, "objects": [ { "id": "...", "type": "line", "bbox": [...], "text": "..." } ] } }
```

The model replies with **new steps only**; it may `erase` or rewrite existing objects.

---

## 3. Streaming (the important part)

`bench/common.py` has an `OpScanner` that tracks JSON depth (root = 1, step = 2, op = 3) and
counts a completed op every time a `}` closes at depth 3. That is how the benchmark measures
“first op” latency, but the player itself only replays fully parsed scripts.

For a live tutor we need to go one step further: **render each op as soon as its object closes**.
That is straightforward in TypeScript:

```text
SSE text chunk
  → append to buffer
  → track in-string / escape / depth
  → when an op object closes at depth 3:
       JSON.parse(substring) → validateOp → enqueue → renderer
```

This gives first-stroke latency equal to the model’s time-to-first-complete-op, which is what
the reference measures (2.5–12.9 s depending on model/thinking).

**SSE normalisation** needed per provider family:

| Family | Endpoint shape | Delta path |
| :--- | :--- | :--- |
| OpenAI-compatible | `POST /chat/completions` `stream:true` | `choices[0].delta.content` |
| Anthropic native | `POST /v1/messages` `stream:true` | `content_block_delta.text_delta` |
| Google Gemini native | `:streamGenerateContent` | `candidates[0].content.parts[].text` |
| Cloudflare Workers AI | `env.AI.run(model, {stream:true})` or REST | SSE `response` chunks |

A single `Provider` interface hides these:

```ts
interface Provider {
  id: string;
  streamChat(input: ChatInput): AsyncIterable<string>; // yields text deltas
}
```

**“Any model/provider” strategy:**
1. **OpenRouter** adapter → one key, hundreds of models (fastest coverage).
2. **OpenAI-compatible** adapter → DeepSeek, Groq, Together, Fireworks, local vLLM, etc.
3. **Anthropic native** adapter → Claude.
4. **Gemini native** adapter → Google AI Studio.
5. **Workers AI** adapter → Cloudflare-hosted models (no external key).
6. Model registry in D1/config with capabilities (streaming, JSON mode, reasoning, context).

---

## 4. Player renderer — what porting means

`player/index.html`:

- `build(op, parent, step, hide)` creates SVG elements (`<text>`, `<line>`, `<rect>`, `<ellipse>`,
  `<path>`).
- `addStroke` / `reveal` animate strokes with `stroke-dashoffset` and a pen cursor.
- `doOp` dispatches op types; `doErase` removes by id/region/all.
- `getState` exports `{atStep, objects:[{id,type,bbox,text}]}` — exactly the interruption payload.
- `validateOp` mirrors the Python validator.

**Port options:**

| Option | What | Trade-off |
| :--- | :--- | :--- |
| **A. Wrap the imperative renderer** | Keep `build/doOp/reveal` almost verbatim inside a React component (`useEffect` + ref) | Fastest, lowest risk; not idiomatic React |
| **B. Re-implement as React SVG components** | `<WriteOp>`, `<LineOp>`, … + animation library | Cleaner, testable; more work |
| **C. iframe the reference player** | Embed `player/index.html` | Fast, but no integration with auth/DB/custom ops |

Recommendation: **A first, then B** once the protocol is stable. C is only a demo shortcut.

---

## 5. Mapping our current `BoardAction` → protocol ops

| Our action | Protocol path | Loss if we keep only v1 |
| :--- | :--- | :--- |
| `addNote`, `addText`, `addWordArt` | `write` (size/color/anchor) | Rich HTML formatting lost |
| `addList` | `write` with `\n` + bullets | List styling lost |
| `addShape` (rect/ellipse/triangle/hexagon) | `rect`, `ellipse`, `path` | Fine |
| `addEquation` | `write` (plain math text) | LaTeX rendering lost |
| `addTable` | **no v1 op** | Must add `table` |
| `addMindMap`, `addFlowchart`, `addTimeline`, `addDiagram` | `path` + `write` (manual) | Layout/auto-graph lost |
| `addImage` (Pollinations / PDF page) | **no v1 op** | Must add `image` |
| `addAtlas`, `addPeriodic` | **no v1 op** | Must add `atlas`, `periodic` |
| `addSticky` | `rect` + `write` | Fine |
| `addCode` | `write` (monospace) | Syntax highlighting lost |
| `connect`, `update`, `remove` | `erase` + new `update` op | Must add `update` |
| `widget` (v1.1 draft) | `widget` op | Reference already drafts this |

This table is the core of the feature-scope decision: **pure v1 loses tables, images, maps,
mind maps, LaTeX, and the subject tools.**

---

## 6. Backend shape (Cloudflare)

```text
Browser (React)
  ├─ POST /v1/chat/stream   SSE: text deltas + parsed ops
  ├─ POST /v1/tts           (later)
  ├─ /v1/lessons            CRUD (D1)
  ├─ /v1/models             model registry
  └─ /auth/*                register/login/logout/me

Worker (Hono)
  ├─ auth middleware        session cookie → D1 session lookup
  ├─ provider gateway       OpenAI-compatible / Anthropic / Gemini / Workers AI
  ├─ rate limit + quotas    D1 usage_events (or Durable Object)
  ├─ D1                    users, sessions, lessons, runs, usage, provider_keys
  └─ R2 (later)            PDFs / page images
```

**D1 schema (MVP):**

```sql
users(id, email, password_hash, password_salt, name, created_at)
sessions(id, user_id, token_hash, expires_at, created_at)
lessons(id, user_id, title, lang, script_json, created_at, updated_at)
runs(id, lesson_id, user_id, provider, model, prompt_tokens, completion_tokens, cost_usd, latency_ms, status, created_at)
usage_events(id, user_id, kind, amount, created_at)
provider_keys(id, user_id, provider, encrypted_key, created_at)  -- BYOK, later
```

**Auth options:**

| Option | Pros | Cons |
| :--- | :--- | :--- |
| Email + password (PBKDF2/WebCrypto, opaque session in D1) | No external dependency; full control | Reset flow needs email; password UX |
| Magic link | No passwords | Needs email provider (Resend/Postmark) |
| Google/GitHub OAuth (`arctic`) | Fast onboarding | Extra config; school SSO later |
| Cloudflare Access | Zero auth code | Only for internal/team, not public SaaS |

Recommendation: **email + password now**, Google OAuth next, magic link later. Sessions: 32-byte
random token, SHA-256 hashed in D1, `HttpOnly; Secure; SameSite=Lax`, 30 days, rotate on login.
PBKDF2-SHA256 with ≥210k iterations (WebCrypto supports it on Workers).

**D1 free tier** is enough for users/sessions/lessons metadata at MVP scale. Do **not** put PDF
text or page images in D1 — use R2 (free tier) or keep them client-side until R2 is wired.

---

## 7. Security notes

- The keys pasted in chat must be treated as compromised: rotate Cloudflare, OpenRouter,
  Pollinations, Gemini. Store only via `wrangler secret put` / `.dev.vars` (gitignored).
- Never send provider keys to the browser. All provider calls go through the Worker.
- The current app’s XSS surface (9 `dangerouslySetInnerHTML` sites) must not be carried over.
  The new renderer builds SVG nodes from validated numbers/strings, not raw HTML — a structural
  improvement. Any `write` text must be rendered as text, never `innerHTML`.
- Add CSP, `X-Content-Type-Options`, `Referrer-Policy`, and an origin check for cookie auth.

---

## 8. Open decisions (need the human)

1. **Feature scope:** pure v1 (6 ops) vs extended protocol (recommended) vs two engines.
2. **Auth:** email/password vs magic link vs OAuth-first.
3. **Keys:** platform keys with quotas vs BYOK vs both.
4. **PDF/images:** R2 now or keep client-side for MVP.
5. **Shell:** keep the current React app and swap the board, or rebuild the frontend around the
   protocol player.

---

## 9. Recommendation (for the design doc)

- **Extended protocol, staged:** start with v1 + `image` + `widget`, then add `table`, `graph`,
  `atlas`, `periodic`, `update`.
- **One op log, one renderer:** manual tools emit the same ops as the AI, so undo/persistence/
  replay are uniform.
- **Hono + D1 + opaque sessions**, email/password first.
- **Provider gateway** with OpenRouter + OpenAI-compatible + Anthropic + Gemini + Workers AI.
- **SSE streaming** with a TypeScript `OpScanner`; render each op as it closes.
- **Port the player renderer as a React SVG component** (option A), refactor to components later.
- **Keep the current app shell** (onboarding, PDF, lab, atlas UI) and replace only the canvas/
  command layer first; migrate tools into the op model incrementally.
