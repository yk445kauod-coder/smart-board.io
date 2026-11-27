# SmartBoard AI — API (المرحلة 1)

آخر تحديث: 2026-11-27 · التنفيذ: `api/index.ts` (Hono على Cloudflare Workers + Neon).

> توثيق الـ Worker القديم على D1 موجود في تاريخ `worker/` فقط؛ ليس مسار الإنتاج.

## المصادقة

- المتصفح: Neon Auth session → `GET {NEON_AUTH_BASE_URL}/token` → `Authorization: Bearer <JWT>`.
- الـ Worker يتحقق من JWT عبر JWKS (`NEON_AUTH_JWKS_URL`)، issuer/audience = أصل Neon Auth.
- لا مفاتيح API للعامة في المرحلة 1.

## المسارات

| Method | Path | الصلاحية | الوصف |
|---|---|---|---|
| GET | `/health`, `/api/health` | عام | فحص DB؛ 200 أو 503 |
| GET | `/api/me` | مستخدم | المستخدم + مؤسساته (ينشئ مساحة أول مرة) |
| POST | `/api/orgs` | مستخدم | إنشاء مؤسسة (`name`, `kind`) |
| GET | `/api/orgs/:orgId` | عضو | بيانات المؤسسة |
| GET | `/api/orgs/:orgId/members` | عضو | قائمة الأعضاء |
| POST | `/api/orgs/:orgId/members` | `members.manage` | إضافة بالبريد/الدور |
| PATCH | `/api/orgs/:orgId/members/:memberId` | `members.manage` | تغيير الدور |
| DELETE | `/api/orgs/:orgId/members/:memberId` | `members.manage` | إزالة عضو |
| GET | `/api/orgs/:orgId/audit` | `audit.read` | آخر 100 حدث |
| GET | `/api/orgs/:orgId/projects` | عضو | المشاريع |
| POST | `/api/orgs/:orgId/projects` | `project.write` | إنشاء مشروع |
| GET | `/api/orgs/:orgId/projects/:id` | عضو | مشروع |
| PATCH | `/api/orgs/:orgId/projects/:id` | `project.write` | تعديل |
| DELETE | `/api/orgs/:orgId/projects/:id` | `project.delete` | حذف |
| GET | `/api/orgs/:orgId/projects/:id/boards` | عضو | سبورات المشروع |
| POST | `/api/orgs/:orgId/boards` | `project.write` | إنشاء سبورة (`projectId`, `title`, `doc`) |
| GET | `/api/orgs/:orgId/boards/:id` | `board.read` | سبورة |
| PATCH | `/api/orgs/:orgId/boards/:id` | `board.write` | `{title?}` أو `{doc?}` (واحد على الأقل) |
| DELETE | `/api/orgs/:orgId/boards/:id` | `board.delete` | حذف |
| GET | `/api/orgs/:orgId/library` | عضو | عناصر المكتبة |
| POST | `/api/orgs/:orgId/library` | `library.write` | حفظ `{title, kind, payload, boardId?}` |
| DELETE | `/api/orgs/:orgId/library/:id` | `library.write` | حذف |
| POST | `/api/orgs/:orgId/boards/:id/live` | `board.read` | sealed query لـ Realtime |
| POST | `/api/orgs/:orgId/uploads` | `storage.write` | رفع ملف (multipart `file`) |
| GET | `/api/orgs/:orgId/files?key=` | عضو | تنزيل موقّع قصير العمر |

كل مسارات `/api/orgs/:orgId/*` تمر بـ `requireAuth` + `withOrgContext` (عضوية + دور).

## أمثلة

```bash
# صحة
curl http://localhost:8787/health

# إنشاء مشروع
curl -X POST "$API/api/orgs/$ORG/projects" \
  -H "Authorization: Bearer $JWT" -H 'content-type: application/json' \
  -d '{"title":"رياضيات","description":""}'

# حفظ سبورة (doc من BoardDoc)
curl -X PATCH "$API/api/orgs/$ORG/boards/$BOARD" \
  -H "Authorization: Bearer $JWT" -H 'content-type: application/json' \
  -d '{"doc":{"version":1,"width":1600,"height":900,"elements":[]}}'
```

## الحدود والأخطاء

- JSON body ≤ 2 MB؛ الرفع ≤ `MAX_UPLOAD_BYTES` (انظر `api/storage.ts`).
- Rate limit داخلي: 240 طلب/دقيقة/IP لـ `/api/*`، وأضيق للإنشاء/الرفع (best-effort لكل isolate).
- شكل الخطأ: `{ "error": { "code", "message", "requestId" } }`.
- 401 بلا توكن/توكن غير صالح؛ 403 صلاحية؛ 404 خارج المؤسسة (لا نكشف الوجود)؛ 429 حد؛ 400 Zod.

## CORS

`APP_ORIGIN` قائمة مفصولة بفواصل. غير المدرج لا يحصل على `Access-Control-Allow-Origin`.
في الإنتاج اضبطه على نطاق Pages.

## الصلاحيات

المصفوفة في `shared/auth/roles.ts`: `owner` كل شيء، `admin` كل شيء عدا `org.manage`،
`teacher` كتابة مشاريع/سبورات/مكتبة/تخزين، `student` قراءة/كتابة سبورة فقط.
