# Design System — SmartBoard AI

> Source of truth for colours and type is `brand-assets/design-tokens.css` and
> `brand-assets/design-tokens.json`. This document explains how to use them and
> how the SaaS surfaces (app, admin, docs) stay consistent.

## 1. Brand idea

**A classroom from the near future — calm, dark, and precise.** A deep navy
"space" surface, a cyan orbital ring, and one amber star. Intelligent but
friendly; never childish, never corporate-cold.

**Tagline:** Teach smarter. Make lessons visual.
**Arabic:** «علّم أذكى. اجعل درسك مرئيًا.»

## 2. Colour

### Brand

| Token | Hex | Use |
| :--- | :--- | :--- |
| `--sb-cosmic-dark` | `#080D1E` | App shell, admin sidebar, hero |
| `--sb-deep-navy` | `#071A3D` | Gradients, PWA theme |
| `--sb-orbital-cyan` | `#00E5FF` | Primary accent, links, AI highlights |
| `--sb-starlight-amber` | `#F59E0B` | Secondary accent, warnings, the logo star |
| `--sb-magenta` | `#D946EF` | Tertiary, used sparingly |
| `--sb-electric-coral` | `#FF5252` | Destructive, live recording |

### Interface

| Token | Hex | Use |
| :--- | :--- | :--- |
| `--sb-board` | `#F8FAFC` | Board canvas |
| `--sb-surface` | `#FFFFFF` | Cards, sheets |
| `--sb-on-surface` | `#0F172A` | Primary text |
| `--sb-surface-variant` | `#F1F5F9` | Secondary surfaces |
| `--sb-primary` | `#059669` | Success/save only (not brand accent) |
| `--sb-tonal` | `#D1FAE5` | Selected chips |

### Semantic rules

- **Cyan = intelligence / action.** Use for AI, links, primary highlights.
- **Amber = attention.** Use for warnings, plan badges, the logo star. Do not use amber for primary buttons.
- **Emerald = success.** Use for "saved", "active", "paid". Do not use emerald as the main brand colour.
- **Coral = destructive.** Suspend, revoke, delete.
- **Never** place body text directly on cyan; use navy ink on cyan.

### Dark surfaces

Admin and docs use a navy sidebar/hero with `#dbeafe` text, `#7dd3fc` muted
labels, and cyan active states. Content areas stay light for long reading.

## 3. Typography

| Role | Arabic | Latin |
| :--- | :--- | :--- |
| Body | IBM Plex Sans Arabic / Cairo | Inter |
| Display | El Messiri / Cairo | Space Grotesk |
| Handwriting | Playpen Sans Arabic | Kalam |
| Numbers | — | tabular numerals in admin tables |

Rules:

- Display sizes use tight tracking (`-0.02em` to `-0.03em`).
- Arabic body line-height ≥ 1.75; Latin ≥ 1.6.
- Never use all-caps for Arabic. All-caps labels are English-only.
- Admin KPI labels: 11px, 700, uppercase, `letter-spacing: .12em`.

## 4. Spacing and radius

- Base unit: **4px**.
- Card padding: 16px; section padding: 24–32px.
- Radius: 10px controls, 16px cards, 24px modals, 999px pills.
- Shadows: `--sb-elev-1` for cards, `--sb-elev-3` for popovers, `--sb-elev-12` for modals.
- Max content width: 1180px for docs, 1440px for admin.

## 5. Components

### Buttons

| Variant | Background | Text | Use |
| :--- | :--- | :--- | :--- |
| Primary | `#080D1E` | white | One per view |
| Accent | `#00E5FF` | `#06121F` | AI / generate |
| Secondary | white + border | ink | Neutral actions |
| Danger | `#FEF2F2` + red border | red | Suspend/revoke |
| Ghost | transparent | ink | Tertiary |

States: hover lifts 1px or darkens 6%; focus ring 3px cyan at 18%; disabled 40% opacity; loading keeps width and swaps label for a spinner.

### Cards

- 1px `#E2E8F0` border, 16px radius, white surface.
- KPI card: label, 26px value, 11px hint.
- Plan card: name, price, tagline, feature list, two actions. Current plan gets a cyan border and `Current` pill.

### Tables

- Sticky header on long lists.
- 11px uppercase header, 12.5px body, row hover `#FAFCFF`.
- Status pills: `ok` emerald, `warn` amber, `bad` red, plan pills cyan/amber/violet.
- Always show empty state with a short explanation.

### Forms

- Label above input, 11px uppercase bold, muted.
- Inputs: 10px radius, 1px border, cyan focus ring.
- Errors: red text below field, never only colour.
- Destructive confirmations: native `confirm()` is acceptable for the admin v1; replace with a modal in v2.

### Modals

- Overlay `slate-950/60` + `backdrop-blur-sm`.
- Panel max-width 4xl, max-height 92vh, scroll inside.
- Sticky header with title, workspace, current plan, close.
- Tabs: Plans / Pay & activate / API keys.

### Pills and badges

- Plan: free (slate), pro (cyan), school (amber), enterprise (violet).
- Status: active (emerald), pending (amber), suspended/revoked (red).
- Use uppercase 10–10.5px, 800 weight, 999px radius.

## 6. RTL rules

- Root `dir` follows the user's language; admin/docs are English LTR.
- Use logical properties (`margin-inline-start`, `padding-inline-end`) in new CSS.
- Icons that imply direction (arrows, back) must flip; the logo, charts, and numbers must not.
- Tables keep numeric columns aligned consistently; in RTL, align numbers to the start of the cell.
- Code blocks and API keys stay LTR even inside an RTL page (`dir="ltr"`).

## 7. Motion

- Duration: 150ms fast, 250ms base.
- Easing: `cubic-bezier(0.16, 1, 0.3, 1)`.
- Animate only `transform` and `opacity` for UI; never animate table row heights.
- Respect `prefers-reduced-motion`: disable transforms, keep opacity.
- Streaming board ops should appear immediately; no entrance animation per op (it would lag behind the model).

## 8. Accessibility

- Contrast: body text ≥ 4.5:1; large text ≥ 3:1. Cyan on navy passes; cyan on white does not for body text.
- Every icon-only button has `aria-label` and a `title`.
- Focus visible on every interactive element.
- Do not rely on colour alone for plan/status; include text.
- Keyboard: modal traps focus, `Esc` closes, first field autofocuses.
- Touch targets ≥ 40px in the app; ≥ 32px in dense admin tables.

## 9. Surface recipes

### Admin console

- Navy sidebar, light content, KPI row, table-first.
- One accent per screen: cyan for AI/provider health, amber for money, emerald for success.
- Dense but breathable: 13px tables, 16px card padding.

### Developer docs

- Navy hero with a short Arabic summary block.
- Sticky left TOC, single reading column.
- Code blocks on `#0B1220` with 12.5px mono.
- One callout style (amber left border) for warnings.

### Billing modal

- White panel on a dimmed board.
- Three tabs, plan cards in a 2-column grid.
- Manual payment is a first-class path, not a fallback hidden behind "contact sales".
- Activation code entry is always visible on the Pay tab.

## 10. Do / don't

| Do | Don't |
| :--- | :--- |
| Use cyan for the one action that matters | Use cyan for every button |
| Show the current plan and period end | Hide billing state in a settings submenu |
| Use Arabic-first labels in the app | Machine-translate English strings |
| Keep admin tables scannable | Put paragraphs inside table cells |
| Show provider health as a dot + text | Rely on a colour dot alone |
| Use the offline builder as a real fallback | Show a dead end when a provider fails |
