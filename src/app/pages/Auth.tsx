import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authConfigured, useAuth } from '../auth';
import { Brand, ErrorNote } from '../components/Shell';

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-slate-50 p-5">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-elev-2 sm:p-8">
        <div className="mb-6 flex flex-col gap-1">
          <Brand />
          <h1 className="mt-4 text-2xl font-bold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfigNotice() {
  if (authConfigured) return null;
  return (
    <div className="mb-4">
      <ErrorNote>
        إعداد المصادقة غير مكتمل. أضف VITE_NEON_AUTH_BASE_URL في البيئة. يمكنك تجربة السبورة من{' '}
        <Link className="font-semibold text-emerald-700" to="/board">السبورة السريعة</Link>.
      </ErrorNote>
    </div>
  );
}

const inputClass =
  'rounded-xl border border-slate-200 px-3 py-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const next = (location.state as { next?: string } | null)?.next ?? '/app/projects';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر الدخول');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="تسجيل الدخول" subtitle="ادخل بإيميلك وكلمة المرور للمتابعة.">
      <ConfigNotice />
      <form className="flex flex-col gap-4" onSubmit={submit}>
        {error && <ErrorNote>{error}</ErrorNote>}
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          الإيميل
          <input
            className={inputClass}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teacher@school.edu"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          كلمة المرور
          <input
            className={inputClass}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </label>
        <button
          className="mt-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-60"
          type="submit"
          disabled={busy}
        >
          {busy ? 'جارٍ الدخول…' : 'دخول'}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-500">
        ليس لديك حساب؟{' '}
        <Link className="font-semibold text-emerald-700" to="/signup">أنشئ حساباً</Link>
      </p>
    </AuthShell>
  );
}

export function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const display = name.trim() || email.split('@')[0] || 'مدرّس';
      await signUp(email.trim(), password, display);
      navigate('/app/projects', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر إنشاء الحساب');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="إنشاء حساب" subtitle="حساب واحد يفتح لك مساحة عمل خاصة، ويمكن دعوة معلمين آخرين.">
      <ConfigNotice />
      <form className="flex flex-col gap-4" onSubmit={submit}>
        {error && <ErrorNote>{error}</ErrorNote>}
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          الاسم
          <input
            className={inputClass}
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="أ. محمد"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          الإيميل
          <input
            className={inputClass}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          كلمة المرور
          <input
            className={inputClass}
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span className="text-xs text-slate-400">8 أحرف على الأقل.</span>
        </label>
        <button
          className="mt-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-60"
          type="submit"
          disabled={busy}
        >
          {busy ? 'جارٍ الإنشاء…' : 'إنشاء الحساب'}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-500">
        لديك حساب؟{' '}
        <Link className="font-semibold text-emerald-700" to="/login">دخول</Link>
      </p>
    </AuthShell>
  );
}
