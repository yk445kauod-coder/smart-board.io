# SmartBoard AI — مراجعة التيك ستاك والاركتكتشر

> **النوع:** مراجعة هندسية مبنية على قراءة الكود + قياسات فعلية (build/typecheck/tests).
> **التاريخ:** 2026-11-27 · **الالتزام:** `4f5f59a` · **المرجع السريع:** `CODEBASE_MAP.md`
> **الحكم في سطر:** نموذج أولي قوي المفاهيم (domain contract واضح، سبورة محلية، provider abstraction)، لكنه **ليس معمارية إنتاج**: مكوّن واحد ضخم، تخزين في `localStorage`، اعتماد على CDN، API مفتوح بلا مصادقة، وسطح XSS حقيقي.

---

## 0) المنهج والأدلة (ما تم قياسه فعلًا)

| الفحص | الأمر | النتيجة |
| :--- | :--- | :--- |
| تثبيت التبعيات | `npm ci` | ❌ يفشل خارج Replit: 13 حزمة في `package-lock.json` تشير إلى `http://package-firewall.replit.internal` (npm 12 يرفض `EALLOWREMOTE`) |
| تثبيت بديل | تعديل مؤقت للروابط ثم `npm ci` | ✅ 233 حزمة في 4 ثوانٍ (ثم أُعيد الـ lockfile كما كان) |
| Type check | `npx tsc --noEmit` | ✅ يمر (لكن `strict` غير مفعّل) |
| Build | `npm run build` | ✅ 366 module → chunk واحد **1,019.22 kB** (gzip **315.54 kB**) + `pdf.worker` **1,375.84 kB** |
| حجم النشر | `du -sh dist` | **16 MB** (منها 13.5 MB صور) |
| الاختبارات | `npm run test:{data,ai,lab,toolkit,edge}` | ✅ 34 + 45 + 13 + 12 + toolkit (كلها PASS) |
| الاختبار الكلي | `npm test` | ❌ يفشل: السكربت يستدعي `pnpm` و`pnpm` غير مثبت |
| تحليل ساكن | grep/import graph | 5 تبعيات غير مستخدمة، كود ميت، و9 مواضع `dangerouslySetInnerHTML` |

---

## 1) جرد التيك ستاك (مع الاستخدام الفعلي)

### Runtime / UI

| الحزمة | النسخة المثبتة | مستخدمة؟ | الدور | ملاحظة معمارية |
| :--- | :--- | :---: | :--- | :--- |
| `react` / `react-dom` | 19.2.8 | ✅ | UI runtime | React 19 + React Flow 11 = توافق يحتاج اختبارًا (peer ranges أقدم) |
| `reactflow` | 11.11.4 | ✅ | canvas + nodes/edges | قلب السبورة؛ كل العناصر nodes |
| `perfect-freehand` | 1.2.2 | ✅ | ضغط القلم | جيد، لكن `getStroke` يُعاد على كل النقاط كل frame |
| `react-simple-maps` | 5.0.5 | ✅ | الأطلس | يُستورد **داخل منتصف** `BoardElements.tsx` (سطر 795) → يمنع code-splitting |
| `pdfjs-dist` | 4.10.38 | ✅ | قراءة PDF + worker | worker 1.37 MB؛ يُحمَّل مع أول استخدام PDF |
| `dompurify` | 3.x | ✅ | تنقية HTML | **يُطبَّق على الشات فقط، لا على محتوى السبورة** |
| Tailwind | CDN | ✅ (runtime) | التنسيق | `cdn.tailwindcss.com` في الإنتاج، ليس build-time |
| Fonts / Icons | Google / cdnjs / jsdelivr | ✅ | الخطوط والأيقونات | 4 مصادر خارجية + React Flow CSS من jsdelivr |

### تبعيات غير مستخدمة (dead dependencies)

| الحزمة | الاستخدام في الكود |
| :--- | :--- |
| `@google/genai` | 0 مراجع — الكود يستخدم REST مباشرة |
| `jspdf` | 0 مراجع — **تصدير PDF غير منفّذ** |
| `html-to-image` | 0 مراجع — نفس السبب |
| `topojson-client` | 0 مراجع — الخريطة تُقرأ من JSON جاهز |
| `world-atlas` | 0 مراجع — نفس السبب |
| `@types/dompurify` | زائد — `dompurify` يوفّر أنواعه |

### Backend / Deploy

| المكوّن | الملف | الدور |
| :--- | :--- | :--- |
| Cloudflare Pages project `smartboard-eg` | `wrangler.toml` | استضافة `dist/` + `/api/tts` |
| Cloudflare Worker `smartboard-ai-api` | `wrangler-api.toml` + `worker-api.ts` | `/api/chat` (المسار الذي يستدعيه العميل فعليًا) |
| Pages Function `/api/chat` | `functions/api/chat.ts` | نسخة مكررة من نفس الـ handler |
| Pages Function `/api/tts` | `functions/api/tts.ts` | Gemini TTS proxy |
| AI binding `AI` | `wrangler.toml` + `wrangler-api.toml` | Workers AI |

---

## 2) التوبولوجيا وقت التشغيل

```text
┌──────────────────────────── Browser (SPA) ────────────────────────────┐
│ React 19 + React Flow + pdfjs + react-simple-maps                      │
│ localStorage: settings / board_snapshot / knowledge_docs / prefs /     │
│               subjects / student_list / vector_memory                  │
│ Service Worker: cache-first للـ same-origin shell + atlas image        │
└───────────────┬───────────────────────────────┬───────────────────────┘
                │ static (16 MB dist)           │ POST /api/chat
                ▼                               ▼
   Cloudflare Pages `smartboard-eg`     Cloudflare Worker `smartboard-ai-api`
   ├─ /  /assets  /sw.js  /manifest      └─ provider loop (15s timeout)
   └─ /api/tts ──► Gemini TTS                 ├─ Cloudflare Workers AI
                                              ├─ Google Gemini
   CDNs (runtime):                            └─ OpenRouter
   tailwindcss.com · aistudiocdn.com
   fonts.googleapis.com · cdnjs · jsdelivr
```

**ملاحظات مهمة:**
- العميل يستدعي الـ Worker مباشرة عبر `globalThis.__SMARTBOARD_API_BASE__` (`index.html` سطر 152)، وليس same-origin. لذلك Pages Function الخاص بالـ chat غير مستخدم فعليًا.
- TTS يسلك العكس: يحاول `/api/tts` النسبي أولًا (Pages)، ثم الـ Worker (الذي لا يملك route لـ TTS)، ثم Gemini مباشرة (بلا مفتاح في المتصفح).
- أول تحميل **يحتاج إنترنت** لـ Tailwind CDN والخطوط والأيقونات وimport map، رغم ادعاء «Offline-ready».

---

## 3) طبقات الكود (Module Graph)

```text
index.tsx
  └─ App.tsx  (God Component: state + handlers + render + persistence + AI orchestration)
       ├─ components/*  (Board, Toolbar, AISheet, PdfWorkspace, Atlas, Lab, Modals)
       ├─ services/ai/* (prompt building, providers, validation, layout, offline builder)
       ├─ services/{knowledge,tts,stt,geminiService}.ts
       ├─ data/*        (periodic, chemistry, atlas, themes)
       └─ types.ts      (ElementType, ElementData, BoardAction, LessonMode, ProjectData)

functions/api/chat.ts ──► services/ai/omnirouter/providers.ts (server-side)
worker-api.ts ─────────► functions/api/chat.ts
```

**لا توجد طبقة domain مستقلة** لعمليات السبورة: تطبيق الأوامر، التراجع، الشرائح، والحفظ كلها داخل `App.tsx` (1060 سطرًا). لا repository layer، ولا store، ولا schema runtime.

---

## 4) معمارية العرض (Rendering)

- **React Flow** هو المحرك: 20 نوع node مسجّل في `components/Board.tsx` (note, list, image, wordArt, shape, code, sketch, comparison, text, ruler, sticky, table, equation, arrow, line, diagram, flowchart, timeline, atlas, periodic).
- كل node مغلّف بـ `memo` في `BoardElements.tsx` ✅ (تقليل re-render).
- الرسم الحر ليس React Flow: overlay `absolute inset-0` مع `perfect-freehand`، ثم يُحوَّل إلى `sketch` node عند `pointerup`. تحسين جيد: تتبّع الضغط `O(1)` بدل مسح كل النقاط.
- **Smart shapes:** `detectNeatShape` يحوّل الخربشة إلى شكل هندسي إذا كانت مغلقة/مستقيمة.
- القيود: لوحة ثابتة 1600×900، pan extent ±20000، slides mode يقيّد `translateExtent`.
- **أداء:** `MiniMap` + `Background` + `Controls` دائمًا مفعّلة؛ `AtlasNode` يرسم خريطة كاملة داخل node؛ `getStroke` يعاد على كل النقاط كل frame. لا virtualization ولا culling.

---

## 5) معمارية الحالة والبيانات (State & Data)

### 5.1 الحالة

- مكوّن واحد `AppContent` فيه ~40 `useState` + `useRef`، بلا Context/Zustand/Redux.
- كل التحديثات تمر عبر `setNodes/setEdges` من `useNodesState/useEdgesState`.
- `window` يُستخدم كقناة ضمنية: `__SMARTBOARD_API_BASE__`, `__SMARTBOARD_AI__`, `__smartboardPdfText`, `__smartboardPdfPages`, `__lastShapeDragCommit`, `__SMARTBOARD_AI_KEY__`. هذا يجعل التدفق غير قابل للاختبار وغير آمن.

### 5.2 مفاتيح التخزين

| المفتاح | المحتوى | المخاطر |
| :--- | :--- | :--- |
| `smartboard_settings` | persona + لغة + صوت | منخفض |
| `smartboard_board_snapshot` | كل nodes/edges (بما فيها نقاط الرسم و**صور PDF كـ data URLs**) | **quota** + بطء |
| `smartboard_knowledge_docs` | **نص PDF كامل** لكل مستند | quota (5–10 MB) |
| `smartboard_prefs` | ثيم/شكل/قلم | منخفض |
| `smartboard_subjects` | مواد مخصصة | منخفض |
| `smartboard_student_list_v2` | أسماء الطلاب | **بيانات شخصية** |
| `smartboard_vector_memory` | ذاكرة متجهية | لا تُكتب أبدًا (انظر §6) |

### 5.3 الحفظ التلقائي والتراجع — أهم مشكلة أداء

```ts
// App.tsx
useEffect(() => {
  localStorage.setItem('smartboard_board_snapshot', JSON.stringify({ nodes, edges, savedAt: Date.now() }));
}, [nodes, edges]);
```

- **بلا debounce**: أثناء سحب أي node، React Flow يطلق `onNodesChange` كل frame → `JSON.stringify` للوحة كاملة + `localStorage.setItem` **كل frame**.
- **التراجع** يعمل بنفس النمط: `JSON.stringify(lastNodes) === JSON.stringify(nodes)` على كل تغيير، ثم يدفع snapshot كامل في `history` (حد 50). السحب الطويل = 50 snapshot + سلسلة JSON ضخمة.
- النتيجة: تقطيع (jank) متوقع مع السبورات المليانة، وكتابة متزامنة على الـ main thread.

### 5.4 PDF والصور

- `PdfWorkspace` يحوّل الصفحة إلى `canvas.toDataURL('image/png')` ويرسلها كـ node. الصورة تُخزَّن داخل `board_snapshot` في `localStorage`.
- مستند PDF نصي كامل يُخزَّن في `knowledge_docs`.
- `localStorage` ≈ 5–10 MB → **صفحتان/ثلاثة كافية لتجاوز الحد**، والخطأ يُلتقط ويُكتب في console فقط (`catch { console.warn }`). المستخدم يرى «Saved locally ✓» بينما الحفظ قد فشل.

### 5.5 عدم وجود تحقق من المخطط

- `JSON.parse` ثم الثقة في الشكل. لا Zod/Valibot. أي snapshot قديم أو تالف قد يُدخل `nodes` بشكل يكسر الـ renderer.
- `types.ts` جيد كتوثيق، لكن `Language = string` و164 استخدام `any` يضعفان الضمانات.

---

## 6) معمارية الذكاء الاصطناعي (AI Pipeline)

```text
AISheet
  └─ App.submitPromptToAI
       └─ assistant.generateLesson
            ├─ buildAssistantSystem(mode) + MODE_HINT[mode]
            ├─ buildUserPrompt: routing hint + prompt + vector memory + knowledge docs
            ├─ POST ${apiBase}/api/chat  { req, system, user }
            │    └─ functions/api/chat.ts
            │         ├─ globalThis.__SMARTBOARD_AI__ = env.AI
            │         ├─ process.env[...] = env[...]
            │         └─ provider loop (15s):
            │              board modes: cloudflare → gemini → openrouter
            │              plain modes: PROVIDERS (cloudflare → openrouter → pollinations → gemini → offline*)
            ├─ textToBoardCommands(text)
            │    ├─ strip fences / extract JSON
            │    ├─ normalizeBoardCommand (aliases)
            │    └─ allow-list
            ├─ layoutCommands (1600×900 grid)
            └─ applyBoardCommands → App.handleToolCall → setNodes
```

### 6.1 ما يعمل

- **عقد أوامر واضح** (`BoardAction`) + تطبيع مرن لأشكال LLM المختلفة + allow-list.
- **سلسلة مزوّدين** مع timeout، ورفض الردود التي لا تحتوي أوامر قابلة للتنفيذ.
- **فصل plain vs board modes**: الشرح/الترجمة/الحل نصية، البناء/التصور أوامر سبورة.
- **TTS** عبر Pages Function مع fallback للمتصفح.

### 6.2 ما هو مكسور/مضلّل

| المشكلة | الدليل | الأثر |
| :--- | :--- | :--- |
| **سياق اللوحة لا يصل للنموذج** | `buildUserPrompt` يستخدم `req.prompt` + docs فقط؛ `req.context.selectedElements/boardSummary/pdfText/pdfPages` غير مقروءة | أوضاع `arrange` و«عدّل المحدد» مستحيلة؛ AI لا «يرى» السبورة |
| **Offline AI غير قابل للوصول** | السيرفر يتخطى `offline` صراحةً؛ العميل لا يستدعي `PROVIDERS` أصلًا | الـ AI يحتاج إنترنت دائمًا، خلافًا للادعاء |
| **الذاكرة المتجهية لا تُكتب** | `storeMemory` مُستورد ولا يُستدعى؛ `recallRelevantMemories` يعود فارغًا | «Forever Vector Memory» ميزة وهمية |
| **لا تخزين مؤقت للردود** | `AICacheEntry` معرّف وغير مستخدم | تكلفة وزمن مكرران |
| **لا streaming** | لا `ReadableStream`/SSE | انتظار 8–15 ثانية قبل أي عنصر |
| **`openrouter/free` غير مضمون** | model id غير قياسي | قد يفشل المزوّد الثالث دائمًا |
| **TTS models مشكوك فيها** | `gemini-2.5-flash` / `2.0-flash` مع `responseModalities: AUDIO` | fallback قد يفشل؛ المتصفح ينقذ التجربة |

### 6.3 سطح XSS (خطر حقيقي)

```text
PDF/مستند غير موثوق
  → نص يُحقن في البرومبت (تنقية regex ضعيفة فقط)
  → LLM يُخرج HTML مثل <img src=x onerror=...>
  → normalizeBoardCommand يمرره كما هو
  → App.handleToolCall يضعه في data.content
  → BoardElements: dangerouslySetInnerHTML={{ __html: content }}
```

- `lib/sanitize.ts` موجود وممتاز نسبيًا، لكنه **مستخدم في الشات فقط** (`AISheet`, `Chat`).
- 9 مواضع `dangerouslySetInnerHTML` في السبورة بلا تنقية.
- `<script>` لا ينفّذ عبر `innerHTML`، لكن `onerror`/`onload` على `<img>`/`<svg>` ينفّذ. هذا XSS كامل في سياق التطبيق.
- إصلاح بسيط: استدعاء `sanitizeHtml` عند **حدود العرض** لكل محتوى AI/مستند (أو في `handleToolCall` قبل التخزين).

---

## 7) معمارية الـ Backend و API

| البند | الحالة | التقييم |
| :--- | :--- | :--- |
| المصادقة | لا يوجد | ❌ أي شخص يستخدم الـ Worker كـ AI proxy مجاني |
| Rate limiting | لا يوجد | ❌ تكلفة/إساءة |
| CORS | `Access-Control-Allow-Origin: *` | ❌ يوسّع سطح الإساءة |
| حدود حجم الطلب | لا يوجد | ⚠️ prompts/PDF ضخمة |
| Timeout | 15s خارجي + 12s لكل مزوّد | ✅ جيد |
| التحقق من المدخلات | فحص وجود `req/system/user` فقط | ⚠️ بلا schema |
| إدارة المفاتيح | env على السيرفر | ✅ لا تظهر في الحزمة |
| تكرار المنطق | Pages Function + Worker لنفس الـ handler | ⚠️ نشران يجب مزامنتهما |
| `process.env` | يُعدَّل لكل طلب على global | ⚠️ نمط غير آمن (race نظريًا) |
| استيراد مزدوج | `import()` لنفس الموديول مرتين في `chat.ts` | ⚠️ كود زائد |
| تسريب أخطاء المزوّد | `502` مع نص أخطاء المزوّدين | ⚠️ معلومات داخلية للمستخدم |

**ملاحظة:** Worker يوجّه **كل** المسارات إلى chat handler، لذا `/api/tts` على الـ Worker سيفشل. العميل يتجنبه لأنه يجرّب المسار النسبي أولًا.

---

## 8) معمارية البناء والتسليم (Build & Delivery)

### 8.1 Vite

- إعداد بسيط: `@vitejs/plugin-react` + alias `@` + dev server على 3000.
- **لا** `manualChunks`، **لا** `React.lazy`، **لا** dynamic imports (إلا في السيرفر).
- النتيجة: chunk واحد **1,019 kB** يحتوي React + React Flow + pdfjs main + react-simple-maps + كل اللوحات.

### 8.2 `index.html`

- Tailwind من CDN (runtime JIT) — لا build، لا purge، لا تحكم في الإصدار.
- `importmap` يربط React/React Flow بـ `aistudiocdn.com` — **بقايا AI Studio وغير مستخدم** بعد الـ bundling، لكنه يبقى في `dist/index.html`.
- 4 مصادر CDN إضافية للخطوط والأيقونات وCSS الخاص بـ React Flow.
- `user-scalable=no` و`maximum-scale=1` → يمنع الزوم (مشكلة وصول).
- `globalThis.__SMARTBOARD_API_BASE__` مكتوب يدويًا في الـ HTML.

### 8.3 الأصول

| الأصل | الحجم | ملاحظة |
| :--- | ---: | :--- |
| `atlas-hero.png` | 4.25 MB | خلفية أطلس بشفافية 25% — يمكن WebP < 300 KB |
| `smartboard-promo-wide.png` | 3.38 MB | **غير مستخدم في التطبيق** ويُشحن في `dist` |
| `smartboard-promo-social.png` | 3.38 MB | **غير مستخدم** ويُشحن في `dist` |
| `smartboard-logo.png` | 1.87 MB | يُحمَّل في الـ landing وفي TopBar |
| `world-countries-110m.json` | 108 KB | معقول |

`dist` = **16 MB**، منها **7.1 MB صور ترويجية لا يحتاجها التطبيق** (لأنها في `public/`).

### 8.4 PWA

- `sw.js` يخزّن `/`, `/index.html`, اللوجو (1.87 MB), `atlas-hero.png` (4.25 MB), والخريطة (108 KB) عند التثبيت.
- cache-first لكل same-origin GET؛ الموارد عبر CDN لا تُخزَّن (cross-origin).
- لا versioning حقيقي (`smartboard-shell-v1` ثابت) ولا استراتيجية تحديث/إبطال واضحة.
- manifest يعلن أيقونات 192/512 لكن الملف 1920×1920، بلا `maskable`.

### 8.5 قابلية التكرار (Reproducibility)

- **`package-lock.json` ملوّث** بـ 13 رابط `package-firewall.replit.internal` → `npm ci` يفشل خارج Replit.
- يوجد `package-lock.json` **و** `pnpm-lock.yaml` معًا.
- `npm test` يستدعي `pnpm` → يفشل على أي جهاز بلا pnpm.
- لا CI (`.github` غير موجود)، لا `_headers`، لا CSP، لا preview environment.

---

## 9) الأداء (Measured + Expected)

| المقياس | القيمة |
| :--- | :--- |
| JS الرئيسي | 1,019 kB min / **315 kB gzip** |
| PDF worker | 1,376 kB |
| `dist` كامل | 16 MB |
| صور غير مستخدمة في النشر | 7.1 MB |
| Tailwind runtime | سكربت CDN + JIT في المتصفح (غير مخزّن بواسطة SW) |
| أول رسم | يتأثر بـ 1.87 MB لوجو + خطوط Google + Tailwind CDN |

**مشاكل أداء مؤكدة من الكود:**
1. حفظ `localStorage` + stringify لكل تغيير (كل frame أثناء السحب).
2. تاريخ التراجع stringify كامل لكل تغيير.
3. `getStroke` على كل النقاط كل frame.
4. `MiniMap` يعيد رسم كل الـ nodes.
5. لا code-splitting: pdfjs + maps + كل المودالات في الحزمة الأولى.
6. أصول ضخمة بلا تحسين.

---

## 10) الأمان (Security Review)

| # | الثغرة | الشدة | الدليل | الإصلاح |
| :---: | :--- | :---: | :--- | :--- |
| 1 | XSS عبر محتوى AI/PDF غير المنقّى | **عالية** | 9 `dangerouslySetInnerHTML` في `BoardElements`/`AISheet`؛ التنقية في الشات فقط | تنقية عند حدود العرض + CSP |
| 2 | AI proxy مفتوح | **عالية** | CORS `*`، بلا auth/rate limit | توكن/جلسة + حدود استخدام |
| 3 | بيانات شخصية في `localStorage` | متوسطة | أسماء الطلاب، اسم المعلم، نصوص PDF | IndexedDB مشفّر + سياسة احتفاظ |
| 4 | Prompt injection | متوسطة | تنقية regex فقط في `neutralizeDocText` | فصل التعليمات + تقييد الأدوات + تقييم |
| 5 | غياب CSP/security headers | متوسطة | لا `_headers` | CSP + `X-Content-Type-Options` + `Referrer-Policy` |
| 6 | CDN غير موثوق | متوسطة | Tailwind/importmap/fonts/jsdelivr | حزم محلية + SRI |
| 7 | منع الزوم | منخفضة | `user-scalable=no` | إزالته + اختبار وصول |

---

## 11) الموثوقية والمراقبة

- `ErrorBoundary` يعيد التحميل فقط، بلا تقرير خطأ (لا Sentry/OpenTelemetry).
- لا retry/backoff/circuit breaker لمزوّدي AI؛ فقط timeout ثم المزوّد التالي.
- أخطاء `localStorage` تُبتلع في console → المستخدم يظن أن الحفظ نجح.
- لا تحليلات استخدام ولا قياس لتكلفة/زمن الاستدلال.
- لا health check ولا version endpoint.
- Service Worker قد يقدّم shell قديمًا بعد النشر.

---

## 12) الحكم المعماري (Verdict)

### نقاط قوة حقيقية
1. **عقد `BoardAction`** كحدود واضحة بين AI والـ renderer — فكرة ممتازة وقابلة للتوسع.
2. **تطبيع + allow-list** لمخرجات LLM — طبقة نضج نادرة في الديمو.
3. **فصل المزوّدين** خلف `TextProvider` — يسهّل التبديل.
4. **السبورة محلية** وتعمل بلا شبكة (الرسم والأدوات)، مع حفظ فوري.
5. **`memo` لكل node** وتحسين تتبّع الضغط.
6. **اختبارات منطق نقي** (تحليل كيمياء، تطبيع أوامر، حالات حدية) تعمل وتنجح.

### نقاط ضعف بنيوية
1. **God Component**: كل شيء في `App.tsx`؛ لا domain layer ولا store.
2. **تخزين غير مناسب**: `localStorage` لنصوص PDF وصور صفحات → quota وفشل صامت.
3. **بلا حسابات/مستأجرين**: لا يمكن بناء SaaS حقيقي فوق هذا.
4. **بلا مصادقة/حدود** على الـ API.
5. **CDN coupling**: الإنتاج يعتمد على 5 مصادر خارجية.
6. **حزمة واحدة 1 MB** بلا تقسيم.
7. **كود ميت وتبعيات ميتة** كثيرة.
8. **سياق اللوحة لا يصل للنموذج** — الميزة الأساسية ناقصة.
9. **XSS** في مسار غير موثوق.

---

## 13) المعمارية المستهدفة (Target Architecture)

```text
apps/web (React 19 + Vite)
  ├─ features/board      (React Flow, commands, undo, slides)
  ├─ features/ai         (chat, lesson modes, streaming)
  ├─ features/pdf        (worker, annotations)
  ├─ features/atlas      (lazy)
  ├─ features/lab        (lazy)
  ├─ store/              (Zustand/RTK: board, ui, session)
  ├─ persistence/        (IndexedDB via Dexie/idb + Zod schemas)
  └─ ui/                 (design system, Tailwind build-time, local fonts)

apps/api (Cloudflare Worker, Hono)
  ├─ POST /v1/chat       (auth, rate limit, Zod, AI gateway, SSE)
  ├─ POST /v1/tts
  ├─ /v1/files           (R2 presigned upload for PDFs)
  └─ /v1/lessons         (D1 metadata, school tenancy)

packages/contracts       (Zod schemas: BoardAction, LessonRequest, ProjectData)
packages/ai              (prompt versions, provider adapters, evals)
```

**قواعد الانتقال:**
- الـ AI لا يُستدعى من المتصفح أبدًا؛ كل المفاتيح على السيرفر.
- كل HTML يُعرض من AI يمر بـ `sanitizeHtml` عند حدود العرض.
- `BoardAction` يُتحقق منه بـ Zod قبل التطبيق.
- PDF/الصور → IndexedDB أو R2، وليس `localStorage`.
- حفظ/تراجع بـ debounce (250–500ms) + `structuredClone` أو patches.
- Lazy load: `pdfjs`, `react-simple-maps`, `GeometryTools`, `SmartLab`.
- Tailwind build-time + خطوط محلية + CSP.

---

## 14) خطة إصلاح مرتبة (Roadmap)

### P0 — قبل أي مستخدم حقيقي (1–2 أسبوع)
1. **تنقية كل محتوى AI** عند العرض (BoardElements) + اختبار XSS.
2. **مصادقة + rate limit** على `/api/chat` و`/api/tts`.
3. **إصلاح `package-lock.json`** (إزالة روابط Replit) + حذف `pnpm-lock` أو توحيده.
4. **إصلاح `npm test`** ليستخدم `npm run` بدل `pnpm`.
5. **debounce** للحفظ والتراجع.
6. تصحيح الادعاءات: «تصدير PDF» و«Offline AI».

### P1 — جودة إنتاج (3–6 أسابيع)
7. نقل PDF/الصور إلى IndexedDB + Zod للمخططات.
8. تمرير سياق اللوحة/المحدد فعليًا إلى البرومبت.
9. Lazy load للوحات الثقيلة + `manualChunks` + ميزانية حزمة.
10. استبدال Tailwind CDN ببناء محلي + خطوط محلية.
11. CI: typecheck + tests + build + bundle budget.
12. Sentry + تحليلات + قياس تكلفة/زمن AI.

### P2 — منتج SaaS (2–4 أشهر)
13. حسابات + مزامنة + عزل مستأجرين.
14. لوحة مدرسة + تقارير + فواتير.
15. AI gateway: caching، retry، circuit breaker، streaming، eval harness.
16. وصول (a11y) + تدقيق خصوصية + سياسة بيانات.

---

## 15) سجل التحقق (Verification Log)

| الفحص | النتيجة |
| :--- | :--- |
| `npx tsc --noEmit` | ✅ exit 0 |
| `npm run build` | ✅ 366 modules، 1,019 kB (315 kB gzip) |
| `npm run test:data` | ✅ 34/34 |
| `npm run test:ai` | ✅ 45/45 |
| `npm run test:lab` | ✅ 13/13 |
| `npm run test:toolkit` | ✅ all passed |
| `npm run test:edge` | ✅ 12/12 |
| `npm test` | ❌ `pnpm: not found` |
| `npm ci` (lockfile كما هو) | ❌ `EALLOWREMOTE` (13 رابط Replit) |
| `du -sh dist` | 16 MB |
| `git status` | لا تغييرات في الملفات المتعقبة (الـ lockfile أُعيد) |

---

*هذه المراجعة تصف الحالة عند `4f5f59a`. أي إصلاح من P0 يغيّر الاستنتاجات — أعد القياس بعده.*
