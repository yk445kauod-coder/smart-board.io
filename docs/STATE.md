# STATE — SmartBoard AI

آخر تحديث: 2026-11-27 · الفرع: `main` @ `9e13803` · الحالة: **المرحلة 1 مدموجة**.
PR #10 مدموج، وCI على `main` ناجح: https://github.com/yk445kauod-coder/smart-board.io/actions/runs/46152185451

هذا الملف هو «أين وصلنا الآن». الخطة ومعايير القبول في `PLAN.md`، والقرارات في `DECISIONS.md`،
وتعارض D1/Neon في `MIGRATION_D1_TO_NEON.md`.

---

## 1. كيف تتحقق بنفسك

```bash
pnpm install --frozen-lockfile
pnpm verify                    # lint + typecheck + unit + isolation + build + e2e
E2E_EMAIL=... E2E_PASSWORD=... pnpm e2e   # يضيف اختبار المصادقة الحقيقي
pnpm api:dev                   # API على 8787 (يحتاج .dev.vars)
pnpm dev                       # واجهة على 3000 مع proxy إلى 8787
```

`pnpm test:isolation` يحتاج `DATABASE_URL` (أو `DATABASE_URL_UNPOOLED`)؛ بدونه يطبع
`ISOLATION SKIP` وينجح، حتى لا يفشل CI بلا قاعدة بيانات.

## 2. خط الأساس (قبل المرحلة 1)

الريبو عند `ff89c0c`: تطبيق demo قديم (React Flow + localStorage) + Worker قديم على D1.
`pnpm typecheck` كان ينجح مع strict مطفأ، و`pnpm test` القديم 148 فحصاً لكنه ليس Vitest.
لا حسابات/عزل/حفظ سحابي في التطبيق الرئيسي.

## 3. الحالة الحالية — ما يعمل بدليل

| البند | الحالة | الدليل |
|---|---|---|
| Neon: postgres + auth + object-storage + functions + realtime | ✅ | `neon deploy` سابق؛ `hello` منشور؛ bucket `uploads` |
| Drizzle schema + migrations + RLS | ✅ | `drizzle-kit migrate` + `db/extra.sql`؛ `ISOLATION PASS` |
| API Hono على Neon | ✅ | `/health`, `/api/me`, orgs/members/projects/boards/library/uploads |
| مصادقة Neon Auth (إيميل/باسورد) | ✅ | auth E2E: دخول حقيقي → `/app/projects` |
| عزل المؤسسات (طبقة `withOrg` + RLS) | ✅ | مؤسستان، قراءة/كتابة عبر SQL خام: `ISOLATION PASS` |
| الأدوار | ✅ | `shared/auth/roles.ts` + 5 اختبارات Vitest |
| السبورة Konva + BoardCommand واحد | ✅ | 16 اختبار reducer/geometry/history + E2E |
| Sticky notes + autosave + استرجاع بعد reload | ✅ | E2E: عنصران بعد reload؛ auth sticky + PATCH 200 |
| المشاريع + المكتبة | ✅ | auth E2E: إنشاء مشروع/سبورة، حفظ في المكتبة، ظهورها في `/app/library` |
| رفع/تنزيل ملفات (Neon Object Storage) | ✅ | رفع 201 + تنزيل bytes متطابقة (جلسة سابقة) |
| Realtime (sealed query) | ✅ | سكربت اشتراك + تحديث صف (جلسة سابقة) |
| `pnpm verify` | ✅ | انظر سجل التحقق أدناه |
| CI GitHub Actions | ✅ | run ناجح: https://github.com/yk445kauod-coder/smart-board.io/actions/runs/46076819282 |

## 4. سجل التحقق (ناتج الأوامر)

### `pnpm verify` بعد الدمج على `main` (مع `.env.local` وبيانات E2E)

```
pnpm lint      → exit 0
pnpm typecheck → exit 0
pnpm test      → Test Files 2 passed (2) · Tests 21 passed (21)
pnpm test:isolation → ISOLATION PASS
pnpm build     → ✓ 686 modules transformed · built in 4.63s
pnpm e2e       → 2 passed (13.3s)
exit code      → 0
```

### `pnpm verify` قبل الدمج (نفس النتيجة)

```
pnpm lint      → exit 0
pnpm typecheck → exit 0
pnpm test      → Test Files 2 passed (2) · Tests 21 passed (21)
pnpm test:isolation → ISOLATION PASS
pnpm build     → ✓ 686 modules transformed · built in ~4.4s
pnpm e2e       → 2 passed (auth-board + guest-board)
```

### أحجام البناء

```
dist/assets/main-*.js        227.80 kB │ gzip:  67.62 kB
dist/assets/styles-*.css      89.09 kB │ gzip:  14.88 kB
dist/assets/konva-*.js       347.28 kB │ gzip: 107.82 kB
dist/assets/pdf.worker.min   1,375.84 kB
```

`legacy` و`pdf` chunks منفصلة، فلا تُحمّل مع المسار الرئيسي.

### Security headers (API)

```
$ curl -D - -o /dev/null http://localhost:8787/health
strict-transport-security: max-age=31536000; includeSubDomains
x-content-type-options: nosniff
x-frame-options: DENY
referrer-policy: no-referrer
permissions-policy: camera=(), microphone=(), geolocation=()
x-request-id: <uuid>
```

### E2E بدون بيانات دخول

```
1 skipped (auth) · 1 passed (guest)
```

### E2E مع بيانات دخول

```
2 passed (13.2s)
```

## 5. ما هو ناقص/غير مختبر (بصراحة)

- **موبايل/تابلت/قلم/لمس** غير مختبرة فعلياً؛ E2E سطح مكتب فقط.
- **offline/reconnect**: الرسم يُحفظ في IndexedDB، لكن سيناريو قطع الشبكة والعودة غير مختبر.
- **zoom/pan/fit** منفذة بلا E2E.
- **بحث/فرز المشاريع** غير منفذ.
- **إدارة الأعضاء من الواجهة** غير منفذة (API فقط).
- **تبديل المؤسسة/إنشاء أنواع مؤسسات** من الواجهة غير منفذ.
- **حذف الحساب والبيانات** غير منفذ (بند بوابة الإطلاق).
- **billing/plans/admin/push/api keys** مؤجلة للمرحلة 3.
- **Neon Functions `hello`** لم يُعد اختباره في هذه الجلسة.
- **الرفع** يمر عبر الـ API (proxy) وليس presigned URL مباشراً؛ يعمل لكنه يستهلك Worker.
- **Rate limit** لكل isolate وليس موزعاً؛ الحماية الحقيقية تحتاج Cloudflare WAF/rate rules.
- **CORS** يعتمد `APP_ORIGIN`؛ في الإنتاج يجب ضبطه على نطاق Pages.
- **JWT منتهي** لم يُختبر (401 بلا توكن/200 بتوكن فقط).
- **التوكن** يُقرأ من `GET /token` وليس `getJWTToken()`؛ موثّق في AGENTS.

## 6. تعارض D1 ← → Neon

- الـ stack المعتمد Neon. `worker/` القديم على D1 باقٍ للقراءة فقط، **غير منشور** كمسار إنتاج.
- لا كتابة مزدوجة ولا مزامنة. جدول المقابل وخطة الترحيل في `MIGRATION_D1_TO_NEON.md`.
- `wrangler-api.toml` ينشر `api/` (Hono + Neon). `worker/wrangler.toml` (D1) لا يُستخدم.
- حذف/أرشفة `worker/` يحتاج موافقة المالك.

## 7. حدود معروفة

- Workers Free: 10ms CPU/طلب، 100k طلب/يوم، 50 subrequest → المعالجة الثقيلة في المتصفح.
- Neon Free: عند نفاد CU-hours/الشبكة يتوقف الاتصال (SQLSTATE 53000 / HTTP 402)؛ البيانات محفوظة.
- Object storage: bucket خاص؛ روابط التنزيل عبر API بمدة قصيرة.
- Neon Auth في التطوير يستخدم SMTP مشتركاً؛ الإنتاج يحتاج SMTP مخصصاً.
- لا أسرار في الريبو: `.env`, `.env.local`, `.dev.vars` gitignored.

## 8. أسئلة/قرارات معلّقة

1. **`worker/`**: أرشفة أم حذف بعد إثبات عدم الاستخدام؟ (يحتاج موافقتك)
2. **SMTP للإنتاج**: Brevo/Resend free tier أم مزود آخر؟ (المرحلة 2)
3. **حدود أقل من 18**: مراجعة قانونية + موافقة ولي أمر قبل الإطلاق.
4. **Live UI**: الطبقة الخلفية جاهزة؛ الواجهة في المرحلة 2.
5. **Billing**: الدفع اليدوي وأكواد التفعيل في المرحلة 3.

## 9. الخطوة التالية

المرحلة 2 — المدرس الذكي: راوتر النماذج، الوكيل (رسم/مقاطعة/تعديل/إكمال)، الصوت، البحث بمصادر،
PDF Lab، Lesson/Live/Agent control. اقرأ `PLAN.md` (قسم المرحلة 2) قبل البدء.
