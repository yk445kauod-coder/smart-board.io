import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../auth';
import { useWorkspace } from '../workspace';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#00e5ff] to-[#059669] text-lg font-black text-[#04121f] shadow-elev-2">
        S
      </span>
      {!compact && (
        <span className="flex flex-col leading-tight">
          <span className="font-display text-base font-bold text-slate-900">SmartBoard AI</span>
          <span className="text-[11px] text-slate-500">سبورة الفصل الذكية</span>
        </span>
      )}
    </span>
  );
}

export function Splash({ label = 'جارٍ التحميل…' }: { label?: string }) {
  return (
    <div className="grid min-h-[60vh] place-items-center p-8 text-center">
      <div className="flex flex-col items-center gap-3 text-slate-600">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600" />
        <p className="text-sm">{label}</p>
      </div>
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
      {children}
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace state={{ next: location.pathname }} />;
  return <>{children}</>;
}

const navLink = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-100'
  }`;

export function AppLayout() {
  const { user, signOut } = useAuth();
  const { orgs, org, setOrgId, loading, error } = useWorkspace();

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <NavLink to="/app/projects" aria-label="SmartBoard AI">
            <Brand />
          </NavLink>
          <nav className="flex items-center gap-1" aria-label="التنقل الرئيسي">
            <NavLink to="/app/projects" className={navLink}>المشاريع</NavLink>
            <NavLink to="/app/library" className={navLink}>المكتبة</NavLink>
            <NavLink to="/board" className={navLink}>سبورة سريعة</NavLink>
          </nav>
          <div className="mr-auto flex items-center gap-2">
            {orgs.length > 1 && (
              <select
                aria-label="المؤسسة"
                className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
                value={org?.id ?? ''}
                onChange={(e) => setOrgId(e.target.value)}
              >
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            )}
            {org && orgs.length === 1 && (
              <span className="hidden rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600 sm:inline">
                {org.name}
              </span>
            )}
            <span className="hidden text-xs text-slate-500 md:inline">{user?.email}</span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              خروج
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-6">
        {error && <div className="mb-4"><ErrorNote>{error}</ErrorNote></div>}
        {loading && orgs.length === 0 ? <Splash label="جارٍ تجهيز مساحة العمل…" /> : <Outlet />}
      </main>
    </div>
  );
}
