# SmartBoard AI

SmartBoard AI is a bilingual (Arabic/English) classroom whiteboard for teachers. It combines a clean infinite canvas with an AI teacher, PDF notes, an interactive atlas, a chemistry lab, and practical classroom tools.

The project is a Vite + React + TypeScript app. It keeps the board and preferences in the browser so a lesson can continue working locally even when the network is unavailable.

## What is included

- **Interactive whiteboard** — pen, highlighter, eraser, text, notes, shapes, arrows, undo/redo, slides, themes, and PDF export.
- **AI Teacher** — creates board content, explains topics, summarizes, translates, asks practice questions, and uses selected board/PDF context.
- **PDF workspace** — reads PDF or text material, supports annotations, and sends pages to the board.
- **Smart Lab** — periodic table, formula parsing, reaction balancing, reactivity checks, and chemistry presets.
- **Interactive Atlas** — world, regional, Middle East, and Egypt views with map pins.
- **Classroom toolkit** — student picker, geometry tools, scientific calculator, lesson timer, fullscreen mode, and Arabic RTL support.

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
functions/api/          Cloudflare Pages API routes for chat and TTS
tests/                  Data, AI command, chemistry, and classroom smoke tests
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
- Lesson content is stored locally in the browser; clearing browser storage clears the local lesson snapshot.
- PDF parsing uses `pdfjs-dist` 4.x to remain compatible with the project's Node 20 runtime.