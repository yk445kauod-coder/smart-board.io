# DECISIONS — SmartBoard AI

سجل القرارات (ADR مختصر). كل قرار: السياق، القرار، البدائل، العواقب/الحدود، والحالة.

---

## ADR-001 — استبدال D1 بـ Neon Postgres (معتمد من المالك)

**السياق:** الـ Worker الحالي (`worker/`) مبني على Cloudflare D1 مع auth بكلمات مرور محلية.
قواعد المشروع تفرض Neon (Postgres + Drizzle + Neon Auth) وتنص صراحة: «لا تستخدم D1: هذا القرار معتمد مني».

**القرار:** مسار الإنتاج الجديد هو `api/` (Hono) + Neon Postgres عبر Drizzle + Neon Auth.
`worker/` القديم يبقى في الريبو للقراءة فقط ولا يُحذف (قاعدة عدم الحذف بلا موافقة).

**العواقب:** جدولان متوازيان مؤقتاً؛ توثيق الاختلاف في STATE. لا كتابة مزدوجة ولا مزامنة بيانات.
**الحالة:** مُنفّذ.

## ADR-002 — سائق Postgres: `@neondatabase/serverless` (Pool عبر WebSocket) + Drizzle

**السياق:** نحتاج **transactions تفاعلية** لتنفيذ `SET LOCAL ROLE` + GUC للـ RLS، وledger atomic
لاحقاً. Workers Free لا يسمح بـ TCP عادي إلا مع Hyperdrive/`nodejs_compat`، و`neon-http` لا يدعم
الجلسات التفاعلية.

**القرار:**
- الـ API على Workers يستخدم `Pool` من `@neondatabase/serverless` فوق WebSocket (يدعم
  `BEGIN/COMMIT` و`SET LOCAL`)، مع `max: 2` و`maxLifetimeSeconds: 0` (يمنع تعليق الاتصال عبر
  سياقات الطلب في Workers).
- كل طلب ينشئ Pool خاصاً به ويُغلق بـ `executionCtx.waitUntil(db.end())`؛ لا مشاركة I/O بين الطلبات.
- سكربتات Node (migrations، isolation، realtime) تستخدم `pg` مباشرة مع `DATABASE_URL_UNPOOLED`.

**البدائل المرفوضة:** `neon-http` (لا transactions تفاعلية → لا RLS بـ GUC)؛ `pg` داخل Worker
بدون Hyperdrive (TCP غير مضمون على الخطة المجانية)؛ D1 (ممنوع بقرار المالك).

**العواقب/الحدود:** Pool لكل طلب يستهلك اتصالات؛ إن تجاوزنا حدود Neon ننتقل إلى Hyperdrive أو
نعيد تصميم العزل. موثّق كخطر في STATE.
**الحالة:** مُنفّذ ومُختبر end-to-end.

## ADR-003 — محرك السبورة: Konva للتطبيق الإنتاجي، React Flow للقديم فقط

**السياق:** Stack يفرض Konva. التطبيق القديم يستخدم React Flow وهو شغّال.

**القرار:** بناء سبورة إنتاجية جديدة في `src/board/` بـ Konva/react-konva، مع الحفاظ على القديم
على `/legacy`. لا إعادة كتابة للقديم ولا حذفه.

**العواقب:** كودان للسبورة مؤقتاً؛ القديم demo غير مُدعوم. الواجهة الجديدة هي مصدر الحقيقة.
**الحالة:** مُنفّذ.

## ADR-004 — Tailwind مبنية وقت البناء (v4) بدل CDN

**السياق:** `index.html` يحمّل `cdn.tailwindcss.com` (غير مناسب للإنتاج: شبكة، FOUC، لا tree-shaking).

**القرار:** `tailwindcss@4` + `@tailwindcss/vite`، مع إعادة تعريف tokens العلامة (emerald/cyan،
خطوط عربية) في CSS. إزالة CDN. `/legacy` يُعرض بنفس tokens بأفضل جهد.

**العواقب:** احتمال فروق بصرية طفيفة في `/legacy`؛ موثّق.
**الحالة:** مُنفّذ.

## ADR-005 — المصادقة: Neon Auth (Managed Better Auth)، إيميل + كلمة مرور

**السياق:** مطلوب إيميل/باسورد بدون Google، وجلسات آمنة، وبيانات في Postgres.

**القرار:**
- `createAuthClient(VITE_NEON_AUTH_BASE_URL)` في المتصفح لـ `signUp.email` و`signIn.email`.
- **فخ:** `client.getJWTToken()` يعيد session token وليس JWT. الـ Worker يتحقق من JWT عبر JWKS،
  لذلك `readToken()` يقرأ `GET {baseUrl}/token` بـ `credentials: 'include'`.
- الـ Worker يتحقق من JWT (EdDSA/Ed25519، ~15 دقيقة) عبر `NEON_AUTH_JWKS_URL` باستخدام `jose`،
  مع `issuer`/`audience` = أصل `NEON_AUTH_BASE_URL`.
- لا hashing لكلمات المرور داخل الـ Worker (حدود CPU)؛ Neon Auth يملك كلمات المرور.

**العواقب:** التحقق من البريد في التطوير عبر SMTP مشترك؛ للإنتاج يلزم SMTP مخصص (قرار مفتوح).
**الحالة:** مُنفّذ ومُختبر (auth E2E).

## ADR-006 — عزل البيانات: طبقة استعلام واحدة + RLS

**القرار:**
1. كل استعلام تطبيقي يمر عبر `db/scoped.ts` ويأخذ `OrgContext {orgId, userId, role}`؛ غياب `orgId` = خطأ.
2. RLS مفعّل على جداول التطبيق بسياسات على `current_setting('app.current_org_id', true)::uuid`.
3. كل معاملة تطبيقية تنفّذ `SET LOCAL ROLE app_user; SET LOCAL app.current_org_id = ...` لتفعيل RLS
   على دور غير مالك. دور `app_user` يُنشأ في migration بصلاحيات CRUD فقط.
4. اختبارات عزل: مؤسستان + SQL خام بدور التطبيق للتأكد أن RLS يمنع التسريب.

**العواقب:** كل معاملة تدفع ثمن `SET LOCAL`؛ مقبول. المالك (`neondb_owner`) يتجاوز RLS، لذا
اختبارات RLS تستخدم `SET ROLE`.
**الحالة:** مُنفّذ.

## ADR-007 — التخزين: Neon Object Storage خلف `StorageProvider`

**القرار:** واجهة `StorageProvider` (`put/get/delete`) مع تنفيذ S3-compatible لـ Neon
(`AWS_ENDPOINT_URL_S3` + مفاتيح branch)، و`MemoryStorage` للاختبارات. المتصفح لا يرى مفاتيح S3:
الرفع يمر عبر `POST /api/orgs/:orgId/uploads` (حتى 10 MB)، والتنزيل عبر
`GET /api/orgs/:orgId/files?key=` بعد التحقق من بادئة `orgId`.
IndexedDB يُستخدم لنسخة السبورة محلياً، لا لتخزين الملفات الكبيرة بعد.

**الحدود:** bucket خاص؛ الرفع يستهلك CPU/ذاكرة الـ Worker (10 MB سقف) وليس presigned مباشراً؛
سعة Neon Object Storage 5 GB/مشروع على Free.
**الحالة:** مُنفّذ ومُختبر (رفع 201 + bytes متطابقة).

## ADR-008 — Realtime: Neon Realtime (sealed queries) لـ Live mode

**القرار:** الـ API يُصدر "sealed query" موقّعاً (`NEON_REALTIME_SECRET` يبقى في الخادم) لصفوف
`board_live` (إسقاط يتزامن بـ trigger من `boards`، لأن Realtime يرفض RLS). المتصفح سيشترك عبر
`@neon/realtime/client`؛ لا يُكشف السر أبداً.
**الحالة:** الطبقة الخلفية مثبتة بسكربت اشتراك/تحديث؛ واجهة Live الكاملة في المرحلة 2.

## ADR-009 — إبقاء التطبيق القديم على `/legacy`

**القرار:** لا حذف لكود شغّال. `/legacy` يعرض `App.tsx` القديم. أي تنظيف لاحق يحتاج موافقة صريحة.
**الحالة:** مُنفّذ.

## ADR-010 — رخصة المرجع `whiteboard-ai-tutor`

**القرار:** المرجع MIT. يُحفظ نص الرخصة عند نسخ أي كود/بروتوكول منه في `THIRD_PARTY_NOTICES.md`.
لا كود منسوخ بعد في المرحلة 1 (البروتوكول الحالي أصلي في `src/protocol`).
**الحالة:** مُنفّذ.

## ADR-011 — سياسة مزودي النماذج (المرحلة 2)

**القرار المسبق (ملزم):**
- Workers AI أساسي (binding، بلا مفتاح)، OpenRouter `:free`، Pollinations (مفتاح)، CodeCraft للتطوير فقط.
- **Gemini ممنوع** (شروط API تمنع التطبيقات الموجّهة لمن هم أقل من 18).
- لا يدخل production أي مزود شروطه غير واضحة أو لا تسمح بالاستخدام التجاري/أقل من 18.
- keyless طبقة احتياطية فقط، وبعد اختبار من Worker منشور.
- لكل مزود: رابط الشروط، السماح التجاري، أقل من 18، التدريب على البيانات — تُوثّق قبل التفعيل.
**الحالة:** مبدأ مسجّل؛ التنفيذ في المرحلة 2.

## ADR-012 — حدود المجاني وماذا يحدث عند نفادها

مصدر أرقام Neon: <https://neon.com/pricing> (فُحص 2026-11-27؛ الخطة الدائمة Free بلا بطاقة).

| الخدمة | الحد المجاني | عند النفاد | البديل |
|---|---|---|---|
| Neon Postgres | 100 مشروع/مؤسسة، 10 فروع/مشروع، **100 CU-hour/مشروع/شهر**، 1 GB تخزين/مشروع و20 GB للحساب، 5 GB شبكة/مشروع/شهر | تعليق compute حتى التجديد (SQLSTATE 53000 / HTTP 402)؛ البيانات لا تُحذف | انتظار التجديد؛ تقليل الاستعلامات/الفهارس |
| Neon Auth | حتى **60k MAU/مشروع** | تسجيل/دخول يتوقف | مزود Auth بديل (خارج النطاق المجاني) |
| Neon Object Storage | **5 GB/مشروع** | فشل رفع/تخزين | حذف ملفات قديمة؛ IndexedDB محلي مؤقت |
| Neon Functions | **10 active + 400 waiting Capacity-Hours**، 1M invocation/مشروع | فشل تنفيذ | تنفيذ في Worker/المتصفح |
| Neon Realtime | مجاني أثناء beta | انقطاع المزامنة | polling/إعادة اتصال |
| Cloudflare Workers | 10ms CPU/طلب، 100k طلب/يوم، 50 subrequest | طلبات تفشل | معالجة في المتصفح، streaming، تخفيف |
| Cloudflare Pages | بناء/نشر ثابت ضمن حد Pages | نشر يفشل | إعادة النشر لاحقاً |
| Workers AI (م2) | 10,000 Neurons/يوم | فشل الطلبات | مزود احتياطي ثم تعطيل الميزة |
| Wikipedia API (م2) | مجاني بحدود مهذبة | 429 | تخزين مؤقت + إبلاغ |
| OpenFreeMap (م3) | بدون ضمان | فشل الخرائط | تبديل المصدر |

**ملاحظات:**
- Neon AI Gateway **يحتاج بطاقة** → لا نستخدمه؛ الراوتر في المرحلة 2 داخل Worker.
- Compute يتوقف تلقائياً بعد 5 دقائق خمول (scale-to-zero)؛ هذا مقبول لتطبيق تعليمي.
- أي تجاوز لـ CU-hours يوقف الاتصال، لا يحذف البيانات؛ يجب مراقبة الاستهلاك قبل الإطلاق.
**الحالة:** موثّق.

## ADR-013 — لا خدمات مدفوعة ولا بطاقات

**القرار:** أي ميزة تحتاج دفعاً تُنفّذ في المتصفح أو بمكتبة مفتوحة أو بحصة مجانية؛ وإلا تُعلن
"غير متاحة" صراحةً. لا تعدد حسابات لتحايل الحصص، ولا cookies/اشتراكات شخصية، ولا endpoints مجهولة.
**الحالة:** ملزم لكل المراحل.

## ADR-014 — Cloudflare Pages: SPA fallback + security headers ثابتة

**السياق:** React Router يحتاج إعادة كل المسارات إلى `index.html`، وPages لا يطبّق رؤوس الـ Worker
على الملفات الثابتة.

**القرار:** `public/_redirects` بقاعدة `/* /index.html 200` (مع بقاء `/legacy.html` والملفات
الثابتة)، و`public/_headers` برؤوس nosniff/frame-options/referrer/permissions/HSTS.
رؤوس الـ API تبقى في Hono middleware.

**العواقب:** لا يمكن اختبار `_redirects` محلياً عبر `vite preview`؛ التحقق النهائي بعد أول نشر
على Pages (غير مختبر بعد).
**الحالة:** مُضاف، غير مختبر على Pages.

## ADR-015 — التعايش مع Worker القديم على D1

**السياق:** `worker/` يضم auth محلي + billing + push + API keys على D1، ويخالف stack Neon.

**القرار:** لا حذف ولا كتابة مزدوجة. `worker/` مرجعي غير منشور، والتطبيق القديم على `/legacy.html`.
خطة الجدول المقابل والترحيل في `docs/MIGRATION_D1_TO_NEON.md`. حذف/أرشفة `worker/` يحتاج موافقة
المالك.

**العواقب:** هويتان مؤقتاً (D1 vs Neon Auth)؛ من سجّل قديماً لا يدخل الجديد بنفس كلمة المرور.
**الحالة:** موثّق، بانتظار قرار المالك.

## ADR-016 — حدود Rate limiting في Workers Free

**القرار:** limiter داخلي (Map لكل isolate) بسقف 240 طلب/دقيقة/IP لكل `/api/*`، وحدود أضيق
للعمليات الحساسة (إنشاء مؤسسة، رفع). هذا **best-effort** ولا يُعتمد عليه وحده؛ الحماية الحقيقية
تكون بقواعد Cloudflare WAF/Rate limiting عند الإطلاق.

**العواقب:** العداد لا يُشارك بين الـ isolates؛ قد يمر طلب زائد. موثّق كقيد.
**الحالة:** مُنفّذ.
