# SmartBoard AI — Brand Guide

> Single reference for the visual identity. Source of truth for colours lives in
> `index.html` (Tailwind config) and `design-tokens.json`; this folder is the
> curated, copy-ready export of every media asset in the repo.

---

## 1. Brand idea

**A classroom from the near future — calm, dark, and precise.** The identity pairs a
deep navy "space" surface with a cyan orbital ring and a single amber star. It reads
as *intelligent but friendly*, not childish and not corporate-cold.

**Tagline:** `Teach smarter. Make lessons visual.`
**Arabic tagline:** «علّم أذكى. اجعل درسك مرئيًا.»

---

## 2. Logo

**Mark:** a pixel-art interactive board (dark navy screen, subtle blue frame and stand)
wrapped by a **cyan orbital ring** (`#00E5FF`) with a **four-point amber star**
(`#F59E0B`) on the screen.

| Property | Rule |
| :--- | :--- |
| Files | `logo/smartboard-logo.png` (1920×1920, transparent) |
| Clear space | ≥ 12% of the mark width on all sides |
| Minimum size | 24 px (favicon) / 96 px (UI) |
| Background | Dark navy or transparent only |
| Do | Keep the ring + star together; scale proportionally |
| Don't | Recolour the ring, crop the star, add shadows, place on busy photos, rotate |

There is currently **no official light-background or monochrome lockup** — if one is
needed, derive it from the source PNG rather than inventing new shapes.

**Wordmark:** "SmartBoard" in white, "AI" in cyan (`#00E5FF`) — as used on the promo
images. On light surfaces, use the navy ink `#080D1E`.

---

## 3. Colour palette

### Core

| Token | Hex | Role |
| :--- | :--- | :--- |
| `cosmic-dark` | `#080D1E` | Primary dark surface / toolbar / promo background |
| `deep-navy` | `#071A3D` | PWA background & theme colour, landing gradient |
| `orbital-cyan` | `#00E5FF` | Brand accent, logo ring, AI highlights, links |
| `starlight-amber` | `#F59E0B` | Secondary accent, the logo star, warnings/attention |
| `magenta` | `#D946EF` | Tertiary accent (used sparingly in lab/geometry) |
| `electric-coral` | `#FF5252` | Destructive / live-recording indicator |

### Interface (Tailwind tokens)

| Token | Hex | Role |
| :--- | :--- | :--- |
| `board` | `#F8FAFC` | Board canvas background |
| `surface` | `#FFFFFF` | Cards and sheets |
| `on-surface` | `#0F172A` | Primary text on light surfaces |
| `surface-variant` | `#F1F5F9` | Secondary surfaces / chips |
| `primary` | `#059669` | Legacy emerald CTA (still used in components) |
| `secondary` | `#10B981` | Legacy emerald hover/accents |
| `tonal` | `#D1FAE5` | Selected chip background |

> ⚠️ **Brand drift:** `PROJECT_DNA.md` says emerald `#059669`; `COMMITTEE_RESULTS.md`
> and the logo say cyan/amber/purple. The code currently uses **both**. Decide on
> cyan as the brand accent and keep emerald only for "success/save" states.

### Board themes

| Theme | Surface | Ink |
| :--- | :--- | :--- |
| White | `#FFFFFF` | `#0F172A` |
| Cream | `#FBF6E9` | `#3B2F1E` |
| Chalk | `#1F3A2E` | `#F2F7F3` |
| Black | `#0B0F14` | `#F8FAFC` |

---

## 4. Typography

| Role | Family | Notes |
| :--- | :--- | :--- |
| Arabic UI / body | **IBM Plex Sans Arabic** | Primary Arabic face, 300–700 |
| Arabic display | **El Messiri** | Headlines, 500–700 |
| Arabic fallback | **Cairo** | 400–800 |
| Latin UI | **Inter** | 300–800 |
| Latin display / numbers | **Space Grotesk** | 400–700, tight tracking |
| Handwriting (board) | **Kalam** (Latin), **Playpen Sans Arabic** (Arabic) | Freehand feel |

Loaded from Google Fonts in `index.html`. For an offline/enterprise build, self-host
the WOFF2 files — do not rely on the CDN.

---

## 5. Voice & tone

- **Clear, encouraging, teacher-to-teacher.** Never patronising.
- **Arabic-first**, with natural English (not literal translation).
- Short sentences. Concrete verbs: *ارسم، اشرح، بسّط، راجع، اختبر*.
- Avoid hype words ("revolutionary", "magic"). Show the outcome instead.
- In-product AI replies should sound like a calm co-teacher, not a chatbot persona.

---

## 6. Imagery style

- Dark navy classroom, soft blue volumetric light, cyan rim light.
- Real teachers and students, engaged, from behind or in profile — never stock-smiling at camera.
- Screen content is the hero: chemistry equations, maps, diagrams.
- Pixel-art accents only for the logo/UI chrome, not for photography.

---

## 7. Asset inventory

| File | Dimensions | Size | Purpose | Used in code |
| :--- | :--- | :--- | :--- | :--- |
| `logo/smartboard-logo.png` | 1920×1920 | 1.87 MB | App logo, favicon, PWA icon, landing hero | `HomeScreen.tsx`, `index.html`, `manifest.webmanifest`, `sw.js` |
| `promo/smartboard-promo-wide.png` | 2560×1440 | 3.38 MB | 16:9 promo / hero / pitch deck cover | not referenced in app (marketing) |
| `promo/smartboard-promo-social.png` | 1664×2080 | 3.38 MB | 4:5 social post (Instagram/LinkedIn) | not referenced in app (marketing) |
| `imagery/atlas-hero.png` | 2560×1440 | 4.25 MB | Atlas panel background texture | `components/AtlasPanel.tsx`, `sw.js` |
| `pwa/manifest.webmanifest` | — | 465 B | PWA manifest (name, colours, icons) | served from `public/` |
| `data/world-countries-110m.json` | — | 108 KB | World TopoJSON for the atlas | `components/AtlasPanel.tsx`, `sw.js` |

**Not copied here (code, not media):** `public/sw.js`, fonts (external), and the
app's generated screenshots.

**Missing assets to commission later:** SVG logo, monochrome logo, light-background
lockup, 1024×1024 app icon without transparency, OG image (1200×630), favicon `.ico`,
and short product demo video.

---

## 8. Do / Don't

| Do | Don't |
| :--- | :--- |
| Use the navy + cyan pairing for dark surfaces | Put the logo on mid-tone or busy imagery |
| Keep generous whitespace around the mark | Stretch, rotate, or add glow to the logo |
| Use amber for one focal point per screen | Use amber and magenta at equal weight |
| Use IBM Plex Sans Arabic for body text | Mix three display fonts in one screen |
| Keep board content high-contrast for projectors | Use low-contrast pastel text on the board |
