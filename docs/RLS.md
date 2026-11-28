# عزل البيانات — Neon Postgres RLS

آخر تحديث: 2026-11-27 · الحالة: مُنفّذ ومُختبر (`ISOLATION PASS`).

---

## 1. القاعدة

كل استعلام تطبيقي يمر عبر طبقة واحدة: `db/scoped.ts`.

```ts
withOrg(pool, { orgId, userId, role }, (db) => db.select().from(projects));
withUser(pool, userId, (db) => db.select().from(organizations)); // قبل اختيار مؤسسة
```

- `withOrg` يرفض `orgId` الفارغ أو غير الـ UUID.
- كل معاملة تبدأ بـ:
  ```sql
  BEGIN;
  SET LOCAL ROLE app_user;
  SELECT set_config('app.current_user_id', $1, true);
  SELECT set_config('app.current_org_id', $2, true);
  ```
- `SET LOCAL` يعمل داخل المعاملة فقط؛ لا يتسرب بين الطلبات.
- `app_user` دور `NOLOGIN` بصلاحيات CRUD فقط، ولا يملك الجداول، لذلك RLS يُطبّق عليه.

## 2. سياسات RLS

الجداول: `organizations`, `memberships`, `projects`, `boards`, `library_items`, `audit_log`.

- `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` (المالك أيضاً يخضع للسياسة في
  الاستعلامات التطبيقية؛ سكربتات الإدارة تستخدم دور الاتصال المالك).
- السياسة الموحدة: `org_id = current_setting('app.current_org_id', true)::uuid`.
- `organizations`: `id = current_org` أو عضوية المستخدم.
- `memberships`: `org_id = current_org` أو `user_id = current_user` (لقراءة عضويتك).
- `WITH CHECK` يمنع الكتابة في مؤسسة أخرى حتى لو حُقن `org_id` في الطلب.

السياسات موجودة في `db/migrations/0000_melodic_the_fallen.sql`، وتُعاد تثبيتها في `db/extra.sql`.

## 3. استثناء Realtime — `board_live`

مُجمِّع استعلامات Neon Realtime يرفض الجداول ذات RLS. لذلك:

- `boards` يبقى محمياً بـ RLS.
- `board_live` جدول إسقاط (projection) بلا RLS، لكنه **لا يُقرأ إلا عبر sealed query** موقّع من
  الـ API، وكل استعلام يفلتر `org_id` صراحةً.
- لا تُكتب أسرار S3/Realtime في المتصفح؛ الاشتراك يمر عبر الـ API.

## 4. اختبار العزل

```bash
DATABASE_URL=... pnpm test:isolation
```

السكربت `tests/integration/isolation.ts`:

1. ينشئ مؤسستين ومستخدمين.
2. يتحقق أن A لا يرى مشروع B عبر `listProjects`/`getProject`.
3. يستعلم SQL خام بدور `app_user` → 0 صفوف من B.
4. يحاول إدخال صف في مؤسسة B من جلسة A → يُرفض.
5. يرفض `orgId` الفارغ.
6. ينظّف الصفوف.

بدون `DATABASE_URL` يطبع `ISOLATION SKIP` وينجح (لـ CI بلا قاعدة بيانات).

## 5. checklist لأي استعلام جديد

- [ ] يمر عبر `withOrg`/`withUser`، لا `pool.query` مباشر في route.
- [ ] `org_id` من `c.get('org').orgId`، لا من body/query.
- [ ] الجدول عليه RLS وسياسة `org_id`.
- [ ] لا استثناءات جديدة إلا بـ sealed query موقّع + فلتر `org_id`.
- [ ] اختبار عزل أو تحديث لاختبار قائم.
