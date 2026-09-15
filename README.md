<div align="center">

# SmartBoard AI 🧑‍🏫

### An AI-powered classroom whiteboard for teachers

Whiteboard + AI Teacher Agent + Educational Knowledge (RAG) + PDF Workspace + Smart Lab + Interactive Maps

</div>

---

## What is SmartBoard AI?

SmartBoard AI is a clean, Material/Stitch-inspired, real-time classroom teaching tool.
A teacher opens SmartBoard, configures a lesson, runs the board, and teaches —
while an **AI Teacher Agent** helps write on the board, draw diagrams, answer
questions, and build lessons from the teacher's own materials (PDFs, books, notes).

The application is **bilingual (English LTR / Arabic RTL)**. The main UI can be
set to English while the AI Teacher answers in Arabic (configurable separately).

---

## Core Educational Engines & Services

### 1. Smart Lab (Chemistry Engine)
- **Periodic Table Data (`data/periodic.ts`)**: 118 chemical elements with symbol, name, Arabic translation, atomic mass, category, and grid positions.
- **Chemistry Engine (`data/chemistry.ts`)**:
  - Chemical formula parsing (e.g. `Fe2(SO4)3`, `Ca(OH)2`).
  - Deterministic reaction equation balancing with GCD matrix reduction.
  - Reactivity displacement series lookups (e.g., `Fe` displaces `Cu`).
  - Common acids, bases, polyatomic ions, salts, and combustion/redox presets.

### 2. Interactive Maps & Atlas Engine
- **Visual Mapping (`data/atlas.ts`, `components/AtlasPanel.tsx`, `components/BoardElements.tsx`)**:
  - Built with `react-simple-maps`, `topojson-client`, `world-atlas`, and D3 projections (`geoEqualEarth`).
  - Regional presets for World, Africa, North America, South America, Asia, Europe, Oceania, Middle East, and Egypt (with governorate pins).
- **Interactive Map Editing & Writing**:
  - Teachers can draw, edit, and write directly on placed map elements on the whiteboard.
  - **AI Recognition**: The AI Teacher Agent reads map stroke metadata (`hasMapStrokes` / `sketches`) from board summary context, allowing the AI to acknowledge and guide around user drawings on maps.

### 3. PDF Workspace & RAG Knowledge Engine
- **PDF Viewing & Annotation (`components/PdfWorkspace.tsx`)**:
  - Powered by `pdfjs-dist`.
  - Full editing and writing tools: pen with color/width options, eraser with live hit detection, and sticky notes.
  - Composite page rendering exports annotated PDF pages as high-resolution image nodes directly to the whiteboard.
- **RAG Knowledge Engine (`services/knowledge.ts`)**:
  - Extracts and chunks PDF text, scores context relevancy, and feeds page-aware document text into the AI Teacher system prompt.

---

## AI Stack & Provider Routing

Secrets are secured server-side on Cloudflare Pages Functions (`functions/api/ chat.ts` and `functions/api/tts.ts`).

| Purpose | Primary Provider | Fallback(s) |
| ------- | ---------------- | ----------- |
| **Board / Lesson Generation (LLM)** | **Cloudflare Workers AI** (`@cf/zai-org/glm-4.7-flash`) | **OpenRouter** (`openrouter/free`) → Deterministic Offline Lesson Generator |
| **Text-to-Speech (TTS)** | **Gemini** (`gemini-3.1-flash-tts-preview`) | Web Speech API |
| **Image Generation** | **Pollinations.ai** URL API | — |
| **Speech-to-Text (STT)** | **Browser Web Speech API** | — |

---

## UI & Design System

- **Layout Architecture**: Inspired by Google Stitch design system, featuring clean elevated cards, responsive sheets, and decluttered workspace views.
- **Pixel Art Chrome Aesthetic**: Subtle retro pixel art badges, borders, and controls inspired by the software logo color palette (emerald green `#059669` / `#10b981`, chalkboard slates, and mint accents).
- **Board Canvas Themes**: Whiteboard, Classic Chalkboard Green, Blackboard, and Cream.

---

## Development & Deployment

### Local Development

```bash
npm install
npm run dev
```

### Running Tests

```bash
# Data smoke tests (periodic table, atlas, themes)
npx tsx tests/data-smoke.test.ts

# AI Teacher agent tests
npx tsx --import ./tests/dom-shims.ts tests/ai-agent.test.ts

# Smart Lab chemistry tests
npx tsx --import ./tests/dom-shims.ts tests/lab-smoke.test.ts
```

### Production Build & Cloudflare Deployment

```bash
npm run build
npm run deploy
```
