import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="grid min-h-dvh place-items-center bg-slate-50 p-6 text-center">
      <div>
        <p className="font-display text-6xl font-black text-emerald-600">404</p>
        <h1 className="mt-3 text-xl font-bold text-slate-900">الصفحة غير موجودة</h1>
        <p className="mt-2 text-sm text-slate-500">تأكد من الرابط أو ابدأ من الصفحة الرئيسية.</p>
        <Link to="/" className="mt-6 inline-flex rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white">
          الرئيسية
        </Link>
      </div>
    </div>
  );
}
