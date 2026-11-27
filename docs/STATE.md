# STATE — SmartBoard AI

آخر تحديث: 2026-11-27 · الفرع: `phase-1` · الحالة: المرحلة 1 قيد التنفيذ.

هذا الملف هو "أين وصلنا الآن". الخطة في `PLAN.md`، والقرارات في `DECISIONS.md`.

---

## 1. خط الأساس (قبل تغييرات المرحلة 1)

بيئة التحقق: Node v24.22.2، pnpm 10.20.0 (corepack)، الريبو عند `ff89c0c`.

| الأمر | الناتج |
|---|---|
| `pnpm install` | نجح (1.4s بعد أول تثبيت) |
| `pnpm build` | نجح: 373 module، `index-*.js` 1,107 kB (342 kB gzip)، `pdf.worker` 1,376 kB |
| `pnpm typecheck` | نجح (strict **مطفأ**) |
| `pnpm test` | **148 فحصاً ناجحاً، 0 فشل** عبر 8 مجموعات: data, ai, lab, toolkit, edge, protocol, auth, push |

## 2. الموجود فعلاً

- **تطبيق تجريبي قديم** (`App.tsx` 1060+ سطر، `components/`، React Flow، localStorage): سبورة غنية
  بصرياً، AI assistant، SmartLab، Atlas، PDF workspace، Sticky، أوضاع متعددة. يعمل لكنه demo،
  بلا حسابات ولا عزل ولا حفظ سحابي.
- **بروتوكول سبورة** (`src/protocol/`): `{title, say, ops}`، 1600×900، scanner/validate/renderer/prompt،
  مع اختبارات (32 فحصاً).
- **Worker قديم على D1** (`worker/`): auth بكلمات مرور محلية، orgs، billing، admin، API keys، push،
  MCP/OpenAPI. يعمل وظيفياً لكنه **مخالف لقرار Stack** (D1) ولا يستخدم Neon Auth.
- **Neon project** `Smai` (`lingering-fog-56895681`)، فرع `production` (`br-shiny-frog-bdagppgn`):
  postgres + auth + object-storage (bucket `uploads`) + functions (`hello`) + realtime، كلها مُهيّأة
  و`neon deploy` نجح. المتغيرات في `.env.local` (gitignored).

## 3. البايظ / المخاطر (مُتحقّق منه أو موثّق)

- Tailwind من CDN في وقت التشغيل + import map ميت + `user-scalable=no`.
- `npm ci` غير مثبت في هذه البيئة؛ pnpm هو المسار.
- `npm test` القديم يعتمد `pnpm` في السكربتات؛ استُبدل بـ `pnpm verify`.
- XSS: `dangerouslySetInnerHTML` في مكونات السبورة/الشات (القديمة).
- Autosave/undo القديم يخزّن السبورة كاملة في localStorage عند كل تغيير (بلا debounce).
- PDF export غير منفّذ فعلياً؛ `jspdf`/`html-to-image` غير مستخدمين.
- AI context يُسقط `req.context`؛ الـ offline unreachable (المرحلة 2).
- لا حسابات/عزل في التطبيق القديم.
- **تعارض Stack:** الـ Worker الحالي D1 + كلمات مرور محلية. القرار المعتمد: Neon. لم يُحذف الكود
  القديم؛ سيُعزل كـ legacy.

## 4. تقدم المرحلة 1

| البند | الحالة | الدليل |
|---|---|---|
| Neon init/deploy (5 خدمات) | ✅ | `neon deploy` → Applied: bucket uploads, function hello |
| Docs (AGENTS/PLAN/STATE/DECISIONS) | ✅ | هذا الملف |
| Foundation/CI | ⏳ | — |
| Board core + tools + sticky | ⏳ | — |
| Accounts/orgs/roles/isolation | ⏳ | — |
| Projects/Library | ⏳ | — |
| `pnpm verify` | ⏳ | — |

## 5. أسئلة/قرارات معلّقة

1. **التعايش مع التطبيق القديم:** تقرر تقديمه على `/legacy` دون حذف. لو تريد حذفه أو دمجه، قل.
2. **D1:** كود `worker/` القديم باقٍ للقراءة فقط؛ مسار الإنتاج هو `api/` على Neon. تأكيدك مطلوب
   قبل حذف `worker/` نهائياً.
3. **بريد التحقق واستعادة كلمة المرور:** Neon Auth يستخدم SMTP مشتركاً في التطوير. للإنتاج يلزم
   SMTP مخصص (مجاني مثل Brevo/Resend free tier) — قرار مطلوب في المرحلة 2.
4. **أقل من 18:** يلزم تدقيق شروط كل مزود + موافقة ولي الأمر. مذكور في بوابة الإطلاق.
5. **Realtime:** الطبقة الخلفية (seal/subscribe) تُثبت في المرحلة 1؛ واجهة Live الكاملة في المرحلة 2.

## 6. حدود معروفة

- Workers Free: 10ms CPU/طلب، 100k طلب/يوم، 50 subrequest — لذلك أي معالجة ثقيلة في المتصفح.
- Neon Free: عند نفاد CU-hours/الشبكة يتوقف الاتصال (SQLSTATE 53000 / HTTP 402) حتى التجديد؛
  البيانات لا تُحذف. التفاصيل في `DECISIONS.md`.
- Object storage: bucket خاص افتراضياً؛ الروابط الموقّعة قصيرة العمر.
