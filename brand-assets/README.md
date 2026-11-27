# SmartBoard AI — Brand Assets

A single, copy-ready folder with every media asset in the repository.

```text
brand-assets/
├── BRAND.md                  # Identity guide: logo, colours, type, voice, do/don't
├── design-tokens.json        # Machine-readable tokens
├── design-tokens.css         # CSS custom properties (mirror of the JSON)
├── logo/
│   └── smartboard-logo.png   # 1920×1920 RGBA — app logo / favicon / PWA icon
├── promo/
│   ├── smartboard-promo-wide.png    # 2560×1440 — 16:9 hero / pitch cover
│   └── smartboard-promo-social.png  # 1664×2080 — 4:5 social post
├── imagery/
│   └── atlas-hero.png        # 2560×1440 — atlas background texture
├── pwa/
│   └── manifest.webmanifest  # PWA metadata (name, colours, icons)
└── data/
    └── world-countries-110m.json   # World TopoJSON used by the atlas
```

## Notes

- **Originals live in `public/`.** This folder is a curated copy for hand-off
  (pitch decks, designers, press kits). If you change an asset, update `public/`
  first, then re-copy it here.
- **Logo** is the only transparent asset (RGBA). Promo and atlas images are RGB.
- **Fonts are not bundled.** The app loads IBM Plex Sans Arabic, Cairo, El Messiri,
  Space Grotesk, Inter, Kalam, and Playpen Sans Arabic from Google Fonts. Self-host
  the WOFF2 files before shipping an offline/enterprise build.
- **No SVG, monochrome, or light-background logo exists yet.** See `BRAND.md` §7
  for the list of assets still to commission.
- **Total size:** ~14 MB (dominated by the four PNGs). Compress or convert to WebP
  before using these in a web build.

See `BRAND.md` for usage rules and `../PROJECT_BRIEF.md` for the product story.
