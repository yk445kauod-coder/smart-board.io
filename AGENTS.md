# AGENTS.md — SmartBoard AI

هذا الملف هو مصدر الحقيقة لكل وكيل يعمل على هذا الريبو. اقرأه كاملاً قبل أي عمل،
ثم اقرأ `docs/STATE.md` و`docs/PLAN.md`. اشتغل على بند واحد في المرة.

---

## 0. قواعد التعامل مع هذا الريبو

- اقرأ `AGENTS.md` و`docs/STATE.md` و`docs/PLAN.md` أول كل جلسة، واشتغل على بند واحد في المرة.
- خطة قصيرة قبل الكود، و commits صغيرة.
- لا تقل إن شيئاً يعمل بدون تشغيله وإرفاق الناتج. ما لم تستطع اختباره اكتبه "غير مختبر".
- لا تحذف أو تُضعف اختباراً لينجح، ولا placeholders أو بيانات وهمية في الإنتاج.
- لو نفس الخطأ استمر 3 محاولات، سجّله وتوقف واسأل.
- اسأل قبل: تغيير الـ stack، migration مدمرة، حذف ملفات موجودة.
- لا push على main ولا commit لأسرار.
- نهاية كل مرحلة: حدّث STATE و PLAN و DECISIONS، وافتح PR فيه ما تغير وطريقة التجربة وناتج الأوامر وصور والحدود المعروفة والأسئلة المعلقة، ثم توقف.

### بنية الريبو الحالية (للملاحظة السريعة)

- `index.tsx` + `src/app/` — التطبيق الإنتاجي الجديد (React Router + Konva + Neon Auth). هو مدخل `/`.
- `legacy.html` + `index-legacy.tsx` + `App.tsx`/`components/`/`services/` — العرض التجريبي القديم (React Flow، localStorage). **لا يُحذف**؛ يُقدَّم على `/legacy.html` و`/legacy` يعيد التوجيه إليه.
- `worker/` — Worker قديم على **D1** (auth/billing/admin/orgs/push). **لا يُحذف**، وغير منشور كمسار إنتاج بعد قرار Neon. التفاصيل في `docs/MIGRATION_D1_TO_NEON.md`.
- `api/` — Worker API الإنتاجي (Hono + Neon Postgres + Neon Auth + Realtime + S3 storage).
- `shared/` — عقود Zod المشتركة بين الواجهة والـ API والاختبارات.
- `db/` — مخطط Drizzle وmigrations وRLS وطبقة `withOrg`/`withUser`.
- `tests/unit/` — Vitest؛ `tests/integration/isolation.ts` — عزل RLS حقيقي؛ `tests/e2e/` — Playwright.
- `docs/` — PLAN / STATE / DECISIONS / MIGRATION_D1_TO_NEON / RLS / API / ADMIN.

### أوامر

```bash
pnpm install
pnpm verify        # lint + typecheck + test + build + e2e (نفس ما في CI)
pnpm dev           # واجهة Vite
pnpm api:dev       # wrangler dev للـ API
pnpm db:generate   # drizzle-kit generate
pnpm db:migrate    # drizzle-kit migrate (DATABASE_URL_UNPOOLED)
pnpm test          # vitest
pnpm test:isolation # عزل RLS (يتخطى نفسه بدون DATABASE_URL)
pnpm e2e           # playwright
E2E_EMAIL=... E2E_PASSWORD=... pnpm e2e   # يشغّل اختبار المصادقة أيضاً
```

### D1 ← → Neon (تعارض واعٍ)

- الـ stack المعتمد **Neon Postgres**؛ لا يُستخدم D1 في أي كود جديد.
- `worker/` القديم (D1 + كلمات مرور محلية + billing + push) باقٍ للقراءة فقط حتى تقرر حذفه.
- لا كتابة مزدوجة ولا مزامنة بيانات بين D1 وNeon. خطة الترحيل والجدول المقابل في
  `docs/MIGRATION_D1_TO_NEON.md`.

### Neon Auth — فخ JWT

- `createAuthClient(url)` يعيد عميل Better Auth، و`client.getJWTToken()` يعيد **session token**
  وليس JWT. الـ Worker يتحقق من JWT عبر JWKS، لذلك نقرأ `GET {NEON_AUTH_BASE_URL}/token`
  بـ `credentials: 'include'` في `src/app/auth.tsx`.
- لا تضع أسرار S3/Realtime في المتصفح؛ الرفع والاشتراك يمران عبر الـ API.

### أسرار

- الأسرار في OpenHands Secrets و/أو Cloudflare secrets فقط. لا تُكتب في أي ملف أو log أو commit.
- `.env`, `.env.local`, `.dev.vars` في `.gitignore`. استخدم `.env.example` و`.dev.vars.example` بالأسماء فقط.

---

## قواعد المشروع

### المنتج
SaaS تعليمي: وكيل ذكاء اصطناعي (مساعد مدرس ومدرس خصوصي للطالب) يرسم على سبورة رقمية ويشرح بالصوت. العربي (RTL) أولاً ثم الإنجليزي. استخدام سهل بيد واحدة بقلم السبورة الرقمية.

المميزات الإلزامية:
- الوكيل: يحضّر السبورة بالرسوم والمحتوى والتنسيق والترتيب المناسب للدرس، يعدّل، يكمل، يفتح سبورة جديدة، يشرح درساً كاملاً بمدة محددة لطالب أو فصل بدون مدرس، ويفهم المنهج والكتب وملفات PDF.
- شرح صوتي، وبحث لحظي للتأكد من المعلومات مع ذكر المصادر.
- أدوات السبورة: قلم، كتابة، ممحاة، أشكال، ألوان، تنقل، سبورات متعددة، تعديل ونسخ ما كتبه الوكيل.
- Sticky notes، و PDF Lab، و Science Lab، و Atlas، وكلها يتحكم فيها الوكيل بالكامل.
- الأوضاع: Live و Whiteboard و Lesson و PDF و Library و Projects و Lessons و Agent control.
- الحسابات: مالك المنصة، مدرسة/سنتر، مدرس مستقل، حساب مشترك بين مدرسين، طالب.
- /admin لمالك المنصة: المؤسسات، المستخدمون والأدوار، الخطط والحدود، الاستهلاك (AI/TTS/PDF/تخزين/مقاعد)، الدفع اليدوي وأكواد التفعيل، تعليق وتفعيل، تغيير الخطة، تحويل وتصفير الرصيد، Impersonation مع Audit Log، Feature flags، تقارير الاستخدام والإيرادات.

### الكود الحالي والمرجع
- لا تعِد كتابة أو تحذف كوداً شغالاً بدون موافقة. لو الـ stack الحالي يخالف المطلوب، اعرض التعارض وخطة النقل وانتظر.
- مرجع محرك السبورة والتوليد: https://github.com/molly554/whiteboard-ai-tutor (MIT، احتفظ بنص الرخصة). انسخه خارج الريبو للقراءة فقط، واقرأ protocol/ و player/. خذ منه: بروتوكول الخطوات {title, say, ops}، وعمليات الرسم على لوحة 1600x900، وتحريك الرسم، والمقاطعة والإكمال من حالة السبورة. ليس فيه backend ولا حسابات ولا صوت.

### الـ Stack
React + Vite + TypeScript strict و Tailwind و React Router. Cloudflare Pages للواجهة، و Workers مع Hono للـ API وراوتر النماذج. Neon للداتابيز (Postgres مع Drizzle) والمصادقة والتخزين والـ functions والـ realtime. Zod و Konva و pdf.js و MapLibre GL و KaTeX و Vitest و Playwright و pnpm. لا تستخدم D1: هذا القرار معتمد مني.

### قاعدة المجاني
ممنوع أي خدمة مدفوعة أو تطلب بطاقة. لو ميزة تحتاج شيئاً مدفوعاً، ابحث بالترتيب عن: (1) تنفيذها داخل المتصفح، (2) مكتبة مفتوحة المصدر، (3) حصة مجانية من Cloudflare، (4) خدمة خارجية مجانية شروطها تسمح باستخدامنا. وثّق الرخصة والحدود وماذا يحدث عند انتهائها في DECISIONS.md. لو لا يوجد حل، قل ذلك صراحة ولا تزيّف الميزة.

نقاط البداية (تحقق من شروطها الحالية قبل الاعتماد):
| الاحتياج | الحل المجاني |
|---|---|
| الذكاء الاصطناعي | Workers AI (10,000 Neurons يومياً، وبعدها تفشل الطلبات) |
| تحويل الكلام لنص | Web Speech API، ثم Whisper على Workers AI |
| نطق العربي | صوت المتصفح، وقيّم Piper داخل المتصفح (راجع رخصة الصوت) |
| PDF و OCR | pdf.js و Tesseract.js داخل المتصفح |
| البحث | Wikipedia API أولاً، وأي بحث ويب أوسع يحتاج موافقتي |
| الخرائط | MapLibre مع OpenFreeMap (بدون ضمان تشغيل، فاجعل المصدر قابلاً للتبديل) |
| العلوم | محاكاة PhET (راجع رخصتها وشروط الاستخدام التجاري) و 3Dmol.js، وبيانات جدول دوري مفتوحة |
| الملفات | Neon object storage خلف واجهة تخزين قابلة للتبديل، مع IndexedDB للعمل بدون نت |

ممنوع: استخدام الحصة المجانية من Gemini API (شروطها تمنع التطبيقات التي يستخدمها من هم أقل من 18). ولا تستخدم ai-gateway.vivorax.online (متوقف).

حدود Workers المجاني: 10ms CPU للطلب و100 ألف طلب يومياً و50 subrequest. لذلك المعالجة الثقيلة في المتصفح، ورد الـ AI يمر streaming، ولا hashing لكلمات مرور داخل الـ Worker. راجع حدود Neon المجانية لكل خدمة ووثقها.

### إعداد Neon (ضمن المرحلة 1)
Set up this app on Neon.
1. `npm i -g neon@latest`. If that fails, use `npx neon@latest` in place of `neon`.
   Authenticate with NEON_API_KEY from the environment. If a neon command opens a browser sign-in, tell me to finish it there. If that times out or fails, ask me to run `neon login`, then retry.
2. In the project root:
   `neon init -y --org-id org-floral-frog-00010642 --project-id lingering-fog-56895681 --branch production --services postgres,auth,object-storage,functions,realtime`
3. `neon deploy`. It provisions the services in neon.ts and pulls their env vars into `.env.local` (or `.env` if it exists).
4. Wire each service into the app's code using those env vars. Consult the installed Neon agent skills for best practices, e.g., what database driver to use given the app architecture and hosting runtime.
5. Prove it works: `npm run build` must pass, then start the app, each wired service must be tested to prove it works end to end.
6. Report what changed, the command output that proves step 5, and anything that failed.

أدوار الخدمات:
- postgres: بيانات التطبيق. auth: إيميل وباسورد بدون Google. object-storage: ملفات PDF والصور. realtime: مزامنة Live mode. functions: المهام الطويلة التي لا تناسب Workers فقط.
- الـ Worker يتحقق من جلسة Neon Auth في Hono لكل طلب محمي.
- تأكد أن .env و .env.local و .dev.vars في .gitignore قبل أي commit.
- لو خدمة غير متاحة في الخطة المجانية أو طلبت بطاقة، لا تفعّلها وأبلغني.
- راجع إيميلات التحقق واستعادة الباسورد وشروط من هم أقل من 18.

### راوتر النماذج المجانية (إلزامي)
- ادرس https://github.com/cheaper-inference/OmniRoute و https://github.com/tashfeenahmed/freellmapi (رخصة MIT): قائمة المزودين، والـ failover، وتتبع الحصص. هما خوادم Node وليسا مصممين للـ Workers حسب المعروف، فابنِ راوتر خفيفاً بـ TypeScript داخل الـ Worker بنفس الفكرة.
- مزود واحد = adapter واحد متوافق مع OpenAI. الإضافة والإيقاف بالإعدادات من /admin بدون تعديل كود.
- اختيار حسب المهمة (رسم، شرح، رؤية، صوت)، و fallback عند 429 أو 5xx أو رد لا يطابق BoardCommand، مع circuit breaker وتتبع حصة كل مزود في Postgres.
- رتّب الموديلات باختبار فعلي على دروس عربية (صحة JSON، دقة الرسم، السرعة)، لا بالاسم. وثّق النتائج.
- لكل مزود سجّل في DECISIONS.md: رابط الشروط، هل يسمح بالاستخدام التجاري، وبمستخدمين أقل من 18، وهل يتدرب على البيانات. لا يدخل production مزود شروطه لا تسمح أو غير واضحة.
- ممنوع: تعدد الحسابات للتحايل على الحصص، ومزودون عبر cookies المواقع أو اشتراكات شخصية، وأي endpoint مجهول.
- المزودون keyless: ابحث عنهم وأضفهم بـ adapters. المسموح في production فقط خدمة معروفة تعلن رسمياً عن استخدام بدون مفتاح وشروطها تسمح باستخدامنا، والباقي للتطوير ببيانات تجريبية.
- حدود keyless غالباً لكل IP، وطلبات Workers تخرج من عناوين مشتركة: اختبر من Worker منشور فعلاً، ولو الشروط تسمح بالنداء من المتصفح فاستخدمه للمحتوى غير الشخصي فقط.
- الـ keyless طبقة إضافية في الـ fallback، وليس المزود الأساسي الوحيد، وكل ردوده تمر بنفس التحقق.
- نقاط بداية keyless (فحص 2026-11-27، أعد التحقق):
  - OVHcloud AI Endpoints المجهول: طلبان في الدقيقة لكل IP ولكل موديل. مرشح للـ fallback بعد مراجعة شروطه.
  - LLM7: لا تستخدمه.
  - Pollinations: المسار القديم بدون مفتاح وحدوده غير منشورة، والحالي يطلب مفتاحاً: تطوير فقط.
  - https://github.com/0xzr/freellmpool (MIT، Python): مرجع لقائمة المزودين وأداة تجربة محلية، وليس للـ Workers.
- اسمح بإضافة OmniRoute أو FreeLLMAPI كمزود خارجي (base URL و key) للتطوير فقط.
- المفاتيح أنا من يضيفها في Cloudflare secrets. اكتب لي قائمة بالمفاتيح المطلوبة وروابط استخراجها، واستمر بالـ mock حتى أضيفها.
- أسماء المفاتيح في قسم "المفاتيح". اقرأها من البيئة فقط، ولا تطبعها أو تكتبها في أي ملف أو commit أو log.

### المزودون المعتمدون (تغلب على أي ذكر آخر)
1. Workers AI: الأساسي.
2. OpenRouter (موديلات :free): مفتاح OPENROUTER_API_KEY.
3. Pollinations: مفتاح POLLINATIONS_API_KEY. تأكد من الحصة المجانية الفعلية للمفتاح.
4. CodeCraft (https://codecraftapi.com/v1، مفتاح CODECRAFT_API_KEY): للتطوير ببيانات وهمية فقط، ومقفول في production.
- Gemini: لا تضفه. شروط الـ API تمنع التطبيقات الموجهة لمن هم أقل من 18 أو المرجح استخدامهم لها.
- Workers AI و OpenRouter و Pollinations لا تدخل production قبل مراجعة شروطها وتوثيقها.

### المفاتيح (أنا أضيف القيم)
| الاسم | الاستخدام | مكانه |
|---|---|---|
| CLOUDFLARE_ACCOUNT_ID | النشر | OpenHands Secrets |
| CLOUDFLARE_API_TOKEN | النشر (أقل صلاحيات: Pages و Workers AI) | OpenHands Secrets |
| OPENROUTER_API_KEY | مزود احتياطي | Secrets + Cloudflare secrets |
| POLLINATIONS_API_KEY | مزود احتياطي | Secrets + Cloudflare secrets |
| CODECRAFT_API_KEY | CodeCraft: https://codecraftapi.com/v1 (متوافق مع OpenAI). الخطة المجانية: 500 ألف token شهرياً و100 طلب في الدقيقة. للتطوير فقط | OpenHands Secrets و .dev.vars فقط |
| NEON_API_KEY | أوامر Neon بدون متصفح | OpenHands Secrets فقط |

- Workers AI يعمل من داخل الـ Worker عبر AI binding بدون مفتاح إضافي.
- متغيرات خدمات Neon يسحبها `neon deploy` تلقائياً.
- أنشئ .env.example و .dev.vars.example بالأسماء فقط، وتأكد أن .env و .dev.vars في .gitignore.
- لو مفتاح غير موجود: عطّل مزوده واستخدم mock، واذكر الناقص في التقرير ولا تتوقف.

### قواعد المعمارية
- أي تغيير في السبورة يمر عبر BoardCommand واحد (Zod): المستخدم والوكيل وكل الأدوات. منه undo/redo والحفظ والإعادة.
- كل أداة تسجل tools بأنواع محددة، والوكيل لا يستدعي غيرها.
- مزودو LLM و TTS و STT والبحث خلف interfaces، مع mock للاختبارات. لا مفاتيح في المتصفح.
- لا تثق في رد الموديل: تحقق من كل op، أصلح أو ارفض (محاولتان). أي op ناقصة خطأ وليست سبورة فارغة ناجحة.
- الحسابات الهندسية ومنع تداخل النصوص في الكود لا في الموديل.
- كل استعلام يمر بطبقة واحدة تفرض org_id، ومعها RLS في Postgres حيث أمكن، مع اختبارات عزل. خصم الرصيد atomic مع ledger.
- حدود يومية للـ AI لكل مستخدم ومؤسسة وللمنصة، مع زر إيقاف. عند انتهائها تبقى السبورة والحفظ شغالين.
- بيانات الطلبة: أقل قدر ممكن، ولا تظهر في اللوجات.

### المراحل (PR لكل مرحلة، فرع phase-N)
1. **السبورة والحسابات:** الأساس و CI، السبورة وكل أدواتها و sticky notes، الحسابات والمؤسسات والأدوار وعزل البيانات، المشاريع والمكتبة.
2. **المدرس الذكي (أول إصدار):** راوتر النماذج، الوكيل (رسم ومقاطعة وتعديل وإكمال)، الصوت، البحث بمصادر، PDF Lab، Lesson و Live و Agent control. تنتهي ببوابة الإطلاق.
3. **المنصة والمعامل:** الخطط والأرصدة و /admin الكامل، Atlas، Science Lab. تنتهي بإعادة بوابة الإطلاق.

داخل المرحلة لا تتوقف: بعد كل بند تحقق، commit، push للفرع، علّم في PLAN.md، وكمّل. لو بند متعطل أو يحتاج قراري سجّله في STATE.md، اجعله خلف feature flag مقفول، وكمّل الباقي.
في Science Lab ادمج فقط المشاريع ذات الرخص الواضحة التي تسمح باستخدامنا.

### بوابة الإطلاق (كل بند بدليل)
- أمر واحد `pnpm verify` يشغل lint و typecheck و tests و build و E2E، ونفسه يعمل في CI ويمنع النشر عند الفشل.
- staging و production بداتابيز منفصلة، و backup واسترجاع مجرّبين فعلاً، وطريقة rollback.
- اختبارات صلاحيات لكل endpoint، و validation و rate limiting و security headers، والأسرار في Cloudflare secrets فقط.
- error logging و health check.
- تجربة على موبايل وتابلت وشاشة كبيرة، ومع نت ضعيف ومقطوع، ولا ضياع بيانات عند التحديث.
- مسودة خصوصية وشروط، وحذف الحساب والبيانات، وموافقة ولي الأمر (تحتاج مراجعة قانونية بشرية).
- docs/RELEASE_REPORT.md: كل بند ناجح أو فاشل أو غير مختبر. أي بند غير ناجح يعني "غير جاهز للإنتاج".

### قواعد الشغل
- اقرأ AGENTS.md و STATE.md و PLAN.md أول كل جلسة، واشتغل على بند واحد في المرة.
- خطة قصيرة قبل الكود، و commits صغيرة.
- لا تقل إن شيئاً يعمل بدون تشغيله وإرفاق الناتج. ما لم تستطع اختباره اكتبه "غير مختبر".
- لا تحذف أو تُضعف اختباراً لينجح، ولا placeholders أو بيانات وهمية في الإنتاج.
- لو نفس الخطأ استمر 3 محاولات، سجّله وتوقف واسأل.
- اسأل قبل: تغيير الـ stack، migration مدمرة، حذف ملفات موجودة.
- لا push على main ولا commit لأسرار.
- نهاية كل مرحلة: حدّث STATE و PLAN و DECISIONS، وافتح PR فيه ما تغير وطريقة التجربة وناتج الأوامر وصور والحدود المعروفة والأسئلة المعلقة، ثم توقف.
