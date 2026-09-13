<div align="center">

# SmartBoard AI 🧑‍🏫

### An AI-powered classroom whiteboard for teachers

Whiteboard + AI Teacher Agent + Educational Knowledge (RAG) + PDF Workspace.

</div>

---

## What is SmartBoard AI?

SmartBoard AI is a clean, Material-inspired, real-time classroom teaching tool.
A teacher opens SmartBoard, configures a lesson, runs the board, and teaches —
while an **AI Teacher Agent** helps write on the board, draw diagrams, answer
questions, and build lessons from the teacher's own materials (PDFs, books, notes).

The application is **bilingual (English LTR / Arabic RTL)**. The main UI can be
set to English while the AI Teacher answers in Arabic (configurable separately).

---

## The four core systems

| System | Description |
| ------ | ----------- |
| **Whiteboard** | Infinite canvas with pen, highlighter, eraser, shapes, text, sticky notes, selection/move, undo/redo, slides, and a theme picker (classic green chalkboard included). |
| **AI Teacher Agent** | One central assistant that prepares lessons, writes directly on the board, draws educational visuals, explains concepts, edits existing board content, and uses the PDF/knowledge context. |
| **Knowledge / RAG** | Teachers can add educational sources (PDF, text, notes). The agent retrieves from them and uses them as the primary lesson context. |
| **PDF Workspace** | Integrated PDF viewer/editor: open PDFs, navigate pages, annotate (pen, eraser, notes), ask the agent about the PDF, and send a page or region to the whiteboard as an image. |

---

## AI stack (used in priority order)

The agent uses the existing AI infrastructure below. **Secrets are only read on
the server** (Cloudflare Functions) or via environment variables — never in the
frontend.

| Purpose | Primary | Fallback(s) |
| ------- | ------- | ----------- |
| Board/lesson generation (LLM) | **Cloudflare Workers AI** — `@cf/zai-org/glm-4.7-flash` | **OpenRouter** `openrouter/free` → deterministic offline lesson generator (no network) |
| Text-to-speech (TTS) | **Gemini** `gemini-3.1-flash-tts-preview` | Browser fallback speech (web speech) |
| Image generation | **Pollinations.ai** (URL-based image API) | — |
| Speech-to-text (STT) | **Browser Web Speech API** (no API key) | — |

### Environment variables (server-side only)

These are consumed by `functions/api/chat.ts` and `functions/api/tts.ts`
(the Cloudflare Pages Functions) and surfaced into `process.env` for the providers:

| Variable | Used for |
| -------- | -------- |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | Cloudflare Workers AI |
| `OPENROUTER_API_KEY` | OpenRouter fallback LLM |
| `POLLINATIONS_API_KEY` | Pollinations image/text generation |
| `GEMINI_API_KEY` | Gemini TTS |
| `API_KEY` | (optional) generic server key |

### How the agent generates a lesson

`services/ai/assistant.ts` → `generateLesson(call, onToolCall, onSpeak)`:

1. Builds a routing hint (`buildRoutingHint`) describing every board command
   the agent may emit (`addWordArt`, `addNote`, `addList`, `addComparison`,
   `addEquation`, `addTable`, `addImage`, `addShape`, `addSticky`, `addMindMap`,
   `addFlowchart`, `addTimeline`, `addDiagram`, `addArrow`, `addLine`, `addCode`,
   `addAtlas`, `addPeriodic`, `connect`, `update`, `remove`).
2. Attaches context: mode, subject, lesson detail, selected elements,
   PDF text/pages, board summary, and **RAG knowledge context**.
3. Tries each real provider in order (Cloudflare → OpenRouter), parses the
   JSON board commands, applies layout, and executes them on the board via
   `onToolCall`.
4. Falls back to a deterministic offline lesson builder so the app never hangs.

---

## The maps / Atlas engine

`data/atlas.ts` provides simplified, pedagogically-clean SVG polygons over a
**1000×500 equirectangular** viewBox:

- `WORLD` — 7 continent/region polygons (`n-america`, `s-america`, `africa`,
  `europe`, `asia`, `oceania`, `middle-east`).
- `EGYPT` — dedicated Egypt map with `points` and `governorates` (locations with
  Arabic/English names).
- `WORLD_PINS` / `PIN_BY_ID` — pin locations for placing country markers.
- `ATLAS_PRESETS` — the region chips used in the Atlas panel.

**How to use maps in a lesson:**
- Open **Atlas** from the toolbar, choose a region, optionally click to pin
  countries, then **Place on board**.
- The AI Teacher can call `addAtlas { regionId }` (e.g. `"egypt"`, `"africa"`)
  directly from the chat to place a map.
- **Draw directly on a placed map:** select a map node and drag with the pen —
  strokes are stored on the node (`data.sketches`) and rendered as red polylines
  on top of the map. They persist with the node and can be undone/cleared.
- **The AI "recognizes" annotations:** when a map with strokes is selected, the
  board summary tells the agent how many teacher annotation strokes are on the
  map, so the agent guides around them (and can add informative cards next to it).

### Periodic table & chemistry (Smart Lab)

- `data/periodic.ts` — 118 elements (symbol, name, Arabic name, atomic mass,
  category, period row, cell color). Used by the `addPeriodic`, periodic node,
  and Smart Lab panel.
- `data/chemistry.ts` — the **chemistry engine** used by the lab:
  `parseFormula()` (e.g. `"Fe2(SO4)3"`), atom counting, deterministic reaction
  balancing with GCD reduction, and reactivity/displacement lookups
  (`Fe` displaces `Cu`, etc.).

---

## PDF workspace + RAG knowledge

- `services/knowledge.ts` — PDF text extraction (pdfjs-dist), chunking,
  retrieval scoring, and `buildKnowledgeContext()` for RAG.
- `components/PdfWorkspace.tsx` — the PDF viewer/editor:
  - open a PDF, navigate pages (prev/next, page count)
  - annotate with **pen** (colors + widths), **eraser**, and **sticky notes**
  - **Send page to whiteboard** composites the page + annotations into a PNG and
    places it on the board as an image
  - collapsible **Knowledge sources** sidebar with Summarize / Explain actions
- When a PDF is opened, its text is stored (`__smartboardPdfText`,
  `__smartboardPdfPages`) and passed to the agent as page-aware context, so the
  teacher can ask "explain this page", "summarize", "visualize", or "teach this".

---

## Onboarding

`components/SmartOnboarding.tsx` guides the teacher through:

1. **Language** (interface + AI response language)
2. **Teaching mode** (classroom, private, online…)
3. **Teacher name** (optional)
4. **Subject** (with custom subjects)
5. **Lesson / topic / brief** (optional)
6. **PDF / book / educational material** (optional)

The data automatically configures the board (topic prefill, AI prompt) and the
AI Teacher.

---

## Development

### Run locally

```bash
npm install
cp .env.example .env   # add your Gemini / Cloudflare / OpenRouter / Pollinations keys
npm run dev             # Vite dev server
```

### Production build

```bash
npm run build
```

### Deploy to Cloudflare Pages

The app ships with `wrangler.toml` (`pages_build_output_dir = "dist"`) and the
server-side AI routes live in `functions/api/`:

```bash
npm run build
npx wrangler pages deploy dist
```

Set the environment variables above (`CLOUDFLARE_ACCOUNT_ID`,
`CLOUDFLARE_API_TOKEN`, `OPENROUTER_API_KEY`, `POLLINATIONS_API_KEY`,
`GEMINI_API_KEY`) as Pages/Workers secrets or in the dashboard.

The project is prepared for Cloudflare Pages full-stack deployment. The React
frontend is emitted to `dist/`, while `functions/api/chat.ts` and
`functions/api/tts.ts` are deployed as Pages Functions automatically. After
authenticating Wrangler with `npx wrangler login`, use:

```bash
npm run deploy:dry   # build and validate the deployment command
npm run deploy       # publish frontend + Pages Functions
```

In the Cloudflare Pages project settings, add `OPENROUTER_API_KEY`,
`POLLINATIONS_API_KEY`, and `GEMINI_API_KEY` as encrypted runtime variables.
The AI routes retain an offline deterministic fallback when provider secrets
are unavailable. The Atlas uses local TopoJSON country data with
`react-simple-maps`, so map rendering does not depend on a paid tiles API.

### Tests (logic-level, no network)

The repository includes lightweight `tsx`-based test suites that exercise the
same production modules the app uses:

```bash
# Data smoke tests (periodic table, atlas, themes)
npx tsx tests/data-smoke.test.ts

# AI Teacher agent core (prompt → board commands → RAG → Arabic enforcement)
npx tsx --import ./tests/dom-shims.ts tests/ai-agent.test.ts

# Smart Lab chemistry engine
npx tsx --import ./tests/dom-shims.ts tests/lab-smoke.test.ts
```

Note: some tests import pdfjs-dist indirectly, which needs browser globals;
`tests/dom-shims.ts` pre-loads them for the Node environment.

---

## Board themes

`data/themes.ts` defines the board background themes:

| Theme | Background | Ink |
| ----- | ---------- | --- |
| `white` | Whiteboard | Black |
| `chalk` | Classic green chalkboard | White chalk |
| `black` | Dark blackboard | White |
| `cream` | Light cream | Black |

The theme picker (color swatch in the bottom toolbar) switches the canvas
background, grid, and default ink. Board preferences are saved in
`localStorage` (`smartboard_prefs`).

---

## Project structure

```
functions/api/     Cloudflare Pages Functions (chat, tts) — server-side secrets
services/ai/       Assistant + omni-router providers (Cloudflare/OpenRouter/offline)
services/          knowledge (RAG), tts, stt, geminiService
data/              periodic, chemistry, atlas, themes
components/        Board, BottomToolbar, AISheet, Chat, PdfWorkspace, AtlasPanel,
                   SmartLabPanel, SmartOnboarding, SettingsModal, board elements
tests/             logic-level test suites (no network)
```
