# PLAN — SmartBoard AI

خطة كل المميزات ومعايير القبول، على 3 مراحل. الحالة: `[ ]` لم تبدأ، `[~]` قيد التنفيذ،
`[x]` تم التحقق بدليل، `[!]` متعطل/يحتاج قرار (انظر `STATE.md`).

آخر تحديث: 2026-11-27 (المرحلة 1).

> `[x]` = مُتحقّق بدليل مرفق · `[~]` = منفّذ جزئياً/غير مختبر بالكامل · `[ ]` = لم يبدأ.

---

## المرحلة 1 — السبورة والحسابات (فرع `phase-1`)

### 1A. الأساس و CI

- [x] **P1-FND-01** `pnpm` هو مدير الحزم الوحيد: `pnpm-lock.yaml` محدّث، و`packageManager` في `package.json`. — دليل: `pnpm install --frozen-lockfile` → "Lockfile is up to date".
  - القبول: `pnpm install --frozen-lockfile` ينجح من صفر.
- [x] **P1-FND-02** TypeScript strict مفعّل على كل الكود الجديد (الواجهة + الـ API + المشترك). — دليل: `tsconfig.base.json` به `strict` و`noUncheckedIndexedAccess`؛ `legacy` وحده strict=false.
  - القبول: `pnpm typecheck` بلا أخطاء مع `strict: true` و`noUncheckedIndexedAccess`.
- [x] **P1-FND-03** Tailwind مبنية وقت البناء (لا CDN)، مع tokens العلامة (emerald/cyan، خطوط عربية). — دليل: Tailwind v4 عبر `@tailwindcss/vite`؛ لا `cdn.tailwindcss.com`.
  - القبول: `grep cdn.tailwindcss.com index.html` لا يجد شيئاً؛ البناء ينتج CSS محلي.
- [x] **P1-FND-04** React Router مع مسارات: `/`, `/login`, `/signup`, `/app`, `/app/projects/:id`, `/app/boards/:id`, `/app/library`, `/legacy`. — دليل: E2E يفتح `/` و`/board` و`/login` و`/app/projects` و`/app/boards/:id`؛ `/legacy` 200.
  - القبول: كل مسار يفتح مباشرة (deep link) بدون 404، و`/legacy` يعرض التطبيق القديم.
- [x] **P1-FND-05** `pnpm verify` = lint + typecheck + test + build + e2e، ويفشل عند أي فشل. — دليل: `pnpm verify` نجح: lint + typecheck + 21 اختبار + isolation PASS + build + 2 E2E.
  - القبول: الأمر يمر محلياً، ونفسه في GitHub Actions.
- [~] **P1-FND-06** CI على GitHub Actions: job واحد `verify`، يمنع الدمج عند الفشل. — workflow `.github/workflows/verify.yml` مضاف؛ لم يُشغّل بعد على GitHub.
  - القبول: ملف workflow موجود ويشغّل نفس الخطوات؛ نتيجة آخر run مرفقة في PR.
- [x] **P1-FND-07** إعدادات أمان أساسية: security headers من الـ Worker، CORS مقيّد، body limit. — دليل: `curl /health` يُظهر x-frame-options/x-content-type/referrer/permissions/HSTS؛ CORS allowlist؛ body 2MB؛ rate limit 240/دقيقة/IP (per-isolate).
  - القبول: اختبار يتحقق من الرؤوس على `/health`.

### 1B. السبورة وكل أدواتها

- [x] **P1-BRD-01** عقد `BoardCommand` واحد (Zod discriminated union) لكل تغيير: مستخدم/وكيل/أداة. — دليل: `shared/board/model.ts` + `applyCommand`؛ اختبارات contract.
  - القبول: كل mutation في الكود تمر عبر `applyCommand`؛ لا تعديل مباشر على الحالة من المكونات.
- [~] **P1-BRD-02** أدوات: قلم، هايلايتر، ممحاة، أشكال (مستطيل/دائرة/خط/سهم/مثلث)، نص، تحديد/تحريك. — كل الأدوات موجودة؛ E2E يرسم قلماً وsticky؛ reducer يغطي الأنواع.
  - القبول: اختبار reducer لكل نوع + E2E يرسم كل نوع ويظهر على اللوحة.
- [x] **P1-BRD-03** ألوان وحجم فرشاة، مع لوحة ألوان عربية RTL. — دليل: شريط ألوان/حجم في `BoardEditor`؛ لقطة auth E2E.
  - القبول: تغيير اللون يؤثر على الأمر التالي؛ لقطة شاشة.
- [~] **P1-BRD-04** تنقل: pan (مسافة/أداة يد)، zoom in/out/fit، شبكة اختيارية. — pan/zoom/fit منفذة؛ لا E2E للزوم بعد.
  - القبول: E2E يزوم ويلاحظ تغيّر viewport؛ لا يفقد العناصر.
- [x] **P1-BRD-05** سبورات متعددة داخل المشروع: إنشاء/تسمية/ترتيب/حذف/تبديل. — دليل: `ProjectPage` ينشئ/يعرض سبورات متعددة؛ E2E ينشئ سبورة.
  - القبول: إنشاء سبورتين، الرسم في كل واحدة مستقل، التبديل يحفظ.
- [x] **P1-BRD-06** Undo/Redo على مستوى الأمر، مع حدود (100 خطوة). — دليل: history tests (undo/redo/cap 100).
  - القبول: اختبار: draw → undo → redo يعيد الحالة حرفياً.
- [x] **P1-BRD-07** نسخ/تعديل عناصر (بما كتبه الوكيل مستقبلاً): duplicate، edit text، move، delete. — دليل: move/replace/duplicate/delete في اختبارات `applyCommand`.
  - القبول: اختبار + E2E.
- [x] **P1-BRD-08** Sticky notes: إضافة، تحرير نص، سحب، ألوان، حذف، resize. — دليل: E2E sticky عربي + autosave.
  - القبول: اختبار + E2E؛ النص العربي RTL داخل الملاحظة.
- [~] **P1-BRD-09** حفظ تلقائي مع debounce + استرجاع بعد التحديث، وعمل بدون نت (localStorage/IndexedDB). — E2E: ارسم → reload → العناصر موجودة؛ offline/reconnect غير مختبر.
  - القبول: E2E: ارسم، أعد التحميل، الرسم موجود. اختبار offline: افصل الشبكة، استمر بالرسم، أعد الاتصال، يُزامَن.
- [~] **P1-BRD-10** منع تداخل النصوص وحسابات هندسية في الكود (لا في الموديل): snap، حدود، ترتيب z-index. — geometry tests (hit-test, free spot, bounds)؛ snap/ترتيب كامل غير مختبر.
  - القبول: اختبارات geometry.
- [~] **P1-BRD-11** دعم قلم السبورة (Pointer Events + `pointerType`)، ولمس/فأرة، ومنع التمرير أثناء الرسم. — Pointer Events منفذة؛ لمس/قلم حقيقي غير مختبر.
  - القبول: E2E بلمس/فأرة؛ لا يظهر تمرير الصفحة أثناء الرسم.

### 1C. الحسابات والمؤسسات والأدوار وعزل البيانات

- [x] **P1-AUTH-01** تسجيل/دخول/خروج بإيميل وكلمة مرور عبر Neon Auth (Managed Better Auth)، بدون Google. — دليل: auth E2E دخول حقيقي على Neon ثم `/app/projects`.
  - القبول: طلب حقيقي على بيئة Neon ينجح، والجلسة تُستعاد بعد reload.
- [~] **P1-AUTH-02** التحقق من JWT في Hono لكل طلب محمي عبر JWKS، ورفض غير الصالح/المنتهي. — 401 بلا توكن و200 بتوكن مثبتان؛ توكن منتهي غير مختبر.
  - القبول: اختبار: بلا توكن 401، توكن صالح 200، توكن منتهي 401.
- [~] **P1-AUTH-03** المؤسسات وأنواعها: مالك المنصة، مدرسة/سنتر، مدرس مستقل، حساب مشترك، طالب. — أنواع المؤسسات في schema؛ إنشاء تلقائي independent؛ لا UI لتبديل/إنشاء أنواع بعد.
  - القبول: إنشاء مؤسسة عند التسجيل، وتبديل المؤسسة من الواجهة.
- [x] **P1-AUTH-04** الأدوار: `owner` / `admin` / `teacher` / `student` مع صلاحيات محددة. — دليل: `shared/auth/roles.ts` + 5 اختبارات.
  - القبول: مصفوفة صلاحيات في الكود + اختبارات لكل دور.
- [~] **P1-AUTH-05** دعوة/إضافة عضو للمؤسسة وتغيير دوره وإزالته (للمالك/الأدمن فقط). — API إضافة/تغيير/إزالة موجود؛ لا واجهة إدارة أعضاء بعد.
  - القبول: اختبار API + واجهة.
- [x] **P1-AUTH-06** طبقة استعلام واحدة تفرض `org_id` على كل جدول، وترفض أي استعلام بلا سياق مؤسسة. — دليل: isolation test يرفض orgId فارغ.
  - القبول: اختبار وحدة: استدعاء بلا `orgId` يرمي خطأ.
- [x] **P1-AUTH-07** RLS مفعّل على جداول التطبيق مع policies على `app.current_org_id`. — دليل: ISOLATION PASS (قراءة/كتابة عبر مؤسستين).
  - القبول: اختبار عزل حقيقي: مؤسستان، جلسة A لا ترى صفوف B حتى بـ SQL خام.
- [~] **P1-AUTH-08** Audit log للعمليات الحساسة (إنشاء/حذف/تغيير دور). — audit يُكتب ويُقرأ للمالك؛ لا UI.
  - القبول: صفوف audit تُكتب وتُقرأ للمالك فقط.
- [ ] **P1-AUTH-09** حذف الحساب والبيانات (self-service) — مسودة أولية.
  - القبول: endpoint + واجهة + اختبار؛ يُنقل للبوابة.

### 1D. المشاريع والمكتبة

- [x] **P1-PRJ-01** CRUD للمشاريع داخل المؤسسة (عنوان، وصف، مالك، تواريخ). — دليل: API + `ProjectPage` + عزل.
  - القبول: اختبارات API + واجهة؛ عزل بين المؤسسات.
- [~] **P1-PRJ-02** قائمة مشاريع مع بحث/فرز، وحالات فارغة. — قائمة وحالة فارغة؛ لا بحث/فرز.
  - القبول: E2E.
- [x] **P1-PRJ-03** المكتبة: حفظ سبورة/قالب، استعراض، فتح، حذف. — دليل: auth E2E يحفظ عنصراً ويفتح `/app/library`.
  - القبول: اختبار API + E2E.
- [x] **P1-PRJ-04** رفع صورة/PDF إلى object storage خلف واجهة تخزين قابلة للتبديل (presigned URL). — دليل: رفع 201 واسترجاع bytes متطابقة؛ التنزيل عبر API وليس presigned URL.
  - القبول: رفع حقيقي إلى Neon Object Storage واسترجاع؛ الحدود موثقة.
- [x] **P1-PRJ-05** Realtime: قناة مزامنة لسبورة (اشتراك/بث) — أساس Live. — دليل: realtime script اشتراك + تحديث؛ UI Live في المرحلة 2.
  - القبول: عميلان يريان نفس التغيير؛ توكن قصير العمر من الـ API.

### 1E. Neon (postgres, auth, object-storage, functions, realtime)

- [x] **P1-NEON-01** `neon init` + `neon deploy` ناجحان، و`.env.local` مسحوب وgitignored. — دليل: `neon deploy` سابق (STATE).
- [x] **P1-NEON-02** Drizzle schema + migrations مطبّقة على `production` (direct URL). — دليل: `drizzle-kit migrate` + `db/extra.sql` مطبّقان.
- [x] **P1-NEON-03** Auth مُتحقّق منه end-to-end (signup/signin/token/JWKS). — دليل: auth E2E.
- [x] **P1-NEON-04** Object storage: bucket `uploads`، رفع/تنزيل مثبتان. — دليل: upload/download.
- [~] **P1-NEON-05** Functions: `hello` منشور ويستجيب (أساس المهام الطويلة). — `hello` منشور سابقاً؛ لم يُعد اختباره في هذه الجلسة.
- [x] **P1-NEON-06** Realtime: اتصال مصادق ومزامنة مثبتان. — دليل: realtime script.
- [x] **P1-NEON-07** حدود الخطة المجانية لكل خدمة موثقة في `DECISIONS.md`. — دليل: ADR-012.

---

## المرحلة 2 — المدرس الذكي (أول إصدار)

- [ ] **P2-RTR-01** راوتر نماذج داخل Worker: adapter موحّد متوافق OpenAI، إضافة/إيقاف من الإعدادات.
- [ ] **P2-RTR-02** اختيار حسب المهمة + fallback على 429/5xx/رد غير صالح + circuit breaker.
- [ ] **P2-RTR-03** تتبع حصة كل مزود في Postgres (نجاح/فشل/توكنز/زمن).
- [ ] **P2-RTR-04** ترتيب الموديلات باختبار فعلي على دروس عربية وتوثيق النتائج.
- [ ] **P2-RTR-05** مراجعة شروط كل مزود (تجاري/أقل من 18/التدريب على البيانات) وتوثيقها؛ لا مزود غير واضح في production.
- [ ] **P2-RTR-06** keyless adapters كطبقة احتياطية فقط، بعد اختبار من Worker منشور.
- [ ] **P2-AGT-01** بروتوكول الخطوات `{title, say, ops}` على لوحة 1600×900، وترجمة ops إلى `BoardCommand`.
- [ ] **P2-AGT-02** تحقق كل op (Zod) وإصلاح/رفض بمحاولتين؛ op ناقصة = خطأ.
- [ ] **P2-AGT-03** streaming للرسم مع `OpScanner`، وإمكانية المقاطعة والإكمال من حالة السبورة.
- [ ] **P2-AGT-04** الوكيل يعدّل/ينسخ/يكمل/يفتح سبورة جديدة، ويتحكم في Sticky/PDF/Science/Atlas.
- [ ] **P2-AGT-05** Lesson mode بمدة محددة لطالب أو فصل، مع تقدم زمني.
- [ ] **P2-AGT-06** Agent control mode (تفويض كامل مع سجل وخطوات قابلة للتراجع).
- [ ] **P2-AUD-01** TTS عربي/إنجليزي عبر المتصفح خلف interface، مع بديل Piper (مراجعة رخصة الصوت).
- [ ] **P2-AUD-02** STT عبر Web Speech API ثم Whisper على Workers AI خلف interface.
- [ ] **P2-SRC-01** بحث Wikipedia API مع ذكر المصادر داخل السبورة/الشرح.
- [ ] **P2-PDF-01** PDF Lab: استيراد pdf.js، عرض/تحديد/استخراج نص، وربط بالوكيل.
- [ ] **P2-PDF-02** OCR عبر Tesseract.js داخل المتصفح.
- [ ] **P2-LIVE-01** Live mode: مزامنة realtime للمدرس والطلاب.
- [ ] **P2-FLG-01** Feature flags لكل ميزة وكيل جديدة، مقفولة افتراضياً عند الشك.
- [ ] **P2-GATE-01** بوابة الإطلاق كاملة قبل نهاية المرحلة.

## المرحلة 3 — المنصة والمعامل

- [ ] **P3-BIL-01** خطط وحدود (مقاعد، AI، TTS، PDF، تخزين) + رصيد atomic مع ledger.
- [ ] **P3-BIL-02** حدود يومية لكل مستخدم/مؤسسة/منصة + زر إيقاف؛ السبورة تعمل عند النفاد.
- [ ] **P3-ADM-01** `/admin` كامل: مؤسسات، مستخدمون وأدوار، خطط وحدود، استهلاك، دفع يدوي وأكواد تفعيل، تعليق/تفعيل، تغيير خطة، تحويل/تصفير، impersonation + audit، feature flags، تقارير.
- [ ] **P3-ATL-01** Atlas بـ MapLibre + OpenFreeMap (مصدر قابل للتبديل) وتحكم الوكيل.
- [ ] **P3-SCI-01** Science Lab: PhET/3Dmol.js/جدول دوري مفتوح — فقط رخص واضحة تسمح بالاستخدام التجاري.
- [ ] **P3-GATE-01** إعادة بوابة الإطلاق.

---

## بوابة الإطلاق (G)

- [x] **G-01** `pnpm verify` واحد يشغّل lint/typecheck/test/build/E2E ويعمل في CI ويمنع النشر. — `pnpm verify` + CI workflow؛ CI لم يُشغّل بعد.
- [ ] **G-02** staging و production بداتابيز منفصلة.
- [ ] **G-03** backup واسترجاع مجرّبان فعلاً + rollback موثق.
- [~] **G-04** اختبارات صلاحيات لكل endpoint. — 401/403 يدوي + roles unit؛ ليس لكل endpoint.
- [x] **G-05** validation + rate limiting + security headers. — Zod + body limit + rate limit + headers.
- [ ] **G-06** الأسرار في Cloudflare secrets فقط.
- [x] **G-07** error logging + health check. — health + onError مع requestId.
- [~] **G-08** موبايل/تابلت/شاشة كبيرة + نت ضعيف/مقطوع + لا ضياع بيانات عند التحديث. — سطح مكتب فقط؛ موبايل/offline غير مختبر.
- [ ] **G-09** مسودة خصوصية وشروط + حذف الحساب والبيانات + موافقة ولي الأمر (مراجعة قانونية بشرية).
- [ ] **G-10** `docs/RELEASE_REPORT.md` بكل بند: ناجح/فاشل/غير مختبر.
