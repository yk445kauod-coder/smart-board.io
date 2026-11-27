# الترحيل من D1 إلى Neon — التعارض والخطة

آخر تحديث: 2026-11-27 · الحالة: موثّق، بانتظار قرار المالك بشأن `worker/`.

---

## 1. لماذا هذا الملف؟

الريبو يحتوي نظامين:

| المسار | الحالة | التخزين | المصادقة | النشر |
|---|---|---|---|---|
| `worker/` + `worker/migrations/*.sql` | **قديم / مرجعي** | Cloudflare **D1** (SQLite) | كلمات مرور محلية (`password_hash` + `password_salt`) + جلسات | Worker `smartboard-api` (D1) |
| `api/` + `db/` + `src/app/` | **الإنتاج** | **Neon Postgres** + Drizzle | **Neon Auth** (Better Auth) + JWT عبر JWKS | Worker `smartboard-ai-api` + Pages |

قواعد المشروع تفرض Neon وتنص: «لا تستخدم D1: هذا القرار معتمد مني». لذلك:

- لا كود جديد يكتب إلى D1.
- لا كتابة مزدوجة (dual write) ولا مزامنة تلقائية.
- `worker/` **لم يُحذف** (قاعدة عدم الحذف بلا موافقة)، لكنه خارج مسار الإنتاج.
- التطبيق القديم يبقى متاحاً كعرض على `/legacy.html` (و`/legacy` يعيد التوجيه).

## 2. جدول المقابل (Mapping)

| D1 (قديم) | Neon (جديد) | ملاحظات |
|---|---|---|
| `users` | `neon_auth.user` | الهوية مملوكة لـ Neon Auth؛ لا `password_hash` في كودنا. |
| `sessions` | `neon_auth.session` + JWT | الـ Worker يتحقق من JWT (EdDSA) عبر `NEON_AUTH_JWKS_URL`. |
| `organizations` (`id TEXT`, `slug`, `plan`, `status`) | `organizations` (`uuid`, `kind`, `owner_user_id`) | `kind`: `platform/school/center/independent/shared`. لا `slug` بعد. |
| `memberships` | `memberships` (`uuid`, `role`) | الأدوار: `owner/admin/teacher/student`. |
| `lessons` (`script_json`) | `projects` + `boards` (`doc jsonb`) + `library_items` | السبورة هي `BoardDoc` (Zod) وليست script حر. |
| `runs` / `usage_events` | **غير مرحّلة** | تحتاج جدول `ai_usage`/ledger في المرحلة 2. |
| `rate_limits` | **غير مرحّلة** | حدّ مؤقت in-memory لكل isolate + قواعد Cloudflare WAF لاحقاً. |
| `subscriptions` | **غير مرحّلة** | المرحلة 3 (خطط/أرصدة). |
| `payment_requests` / `activation_codes` | **غير مرحّلة** | المرحلة 3 (دفع يدوي وأكواد). |
| `api_keys` | **غير مرحّلة** | المرحلة 2/3 عند الحاجة لواجهة API خارجية. |
| `audit_log` | `audit_log` (`uuid org_id`, `actor_user_id`, `meta jsonb`) | يُكتب عند إنشاء/حذف/تغيير دور/مشروع/سبورة/مكتبة. |
| `push_subscriptions` | **غير مرحّلة** | المرحلة 2/3. |
| `lessons` القديمة في `localStorage` | `boards.doc` + IndexedDB cache | لا استيراد تلقائي؛ يمكن إضافة زر استيراد لاحقاً. |

## 3. خطة الترحيل إن طُلبت بيانات قديمة

1. تصدير D1 (CSV/JSON) من بيئة **staging** فقط، وليس من الإنتاج.
2. مطابقة المستخدمين بالإيميل: `D1 users.email` → `neon_auth.user.email`؛ من لا يطابق يُنشأ له
   حساب بدعوة، ولا تُنقل كلمات المرور (Neon Auth لا يستورد hashes).
3. تحويل `lessons.script_json` إلى `BoardDoc` عبر سكربت لمرة واحدة (best-effort) ووضعه في
   `boards.doc` تحت مشروع «مستورد».
4. تشغيل السكربت في transaction واحدة لكل مؤسسة، مع `SET LOCAL ROLE app_user` و`app.current_org_id`
   لضمان RLS.
5. التحقق: عدد الصفوف، عيّنة سبورات، واختبار عزل. لا كتابة مزدوجة.

**لا يوجد سكربت ترحيل بيانات في المرحلة 1** لأن بيانات الـ demo ليست إنتاجية.

## 4. المخاطر المفتوحة

- **هويتان** مؤقتاً: من سجّل في القديم لا يستطيع الدخول للجديد بنفس كلمة المرور.
- **روابط قديمة**: `/legacy.html` يعمل، لكن API القديم غير منشور؛ الشات/AI القديم لن يعمل.
- **Billing/Push/API keys** غير موجودة في Neon بعد (المرحلة 3).
- **`worker/wrangler.toml`** يحتوي `database_id` لـ D1 (ليس سراً)؛ لا يُستخدم في النشر الجديد.
- حذف `worker/` أو بيانات D1 يحتاج موافقة صريحة من المالك.

## 5. قرار مطلوب من المالك

هل نأرشف `worker/` (نقله إلى `legacy/worker-d1/` أو حذفه) بعد إثبات عدم استخدامه في الإنتاج؟
حتى القرار، يبقى كما هو دون تعديل.
