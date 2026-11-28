import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';
import { useAuth } from '../auth';
import { useWorkspace } from '../workspace';
import type { Project } from '../types';
import { ErrorNote, Splash } from '../components/Shell';

export function ProjectsPage() {
  const { token } = useAuth();
  const { orgId } = useWorkspace();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<{ projects: Project[] }>(`/api/orgs/${orgId}/projects`, { token });
      setProjects(result.projects);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تحميل المشاريع');
    } finally {
      setLoading(false);
    }
  }, [orgId, token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial async fetch
    void load();
  }, [load]);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/orgs/${orgId}/projects`, {
        method: 'POST',
        token,
        body: { title: title.trim(), description: description.trim() },
      });
      setTitle('');
      setDescription('');
      setCreating(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر إنشاء المشروع');
    } finally {
      setBusy(false);
    }
  };

  if (loading && projects.length === 0) return <Splash label="جارٍ تحميل المشاريع…" />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">المشاريع</h1>
          <p className="text-sm text-slate-500">نظّم دروسك في مشاريع، وداخل كل مشروع سبورات متعددة.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreating((value) => !value)}
          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          {creating ? 'إلغاء' : 'مشروع جديد'}
        </button>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {creating && (
        <form onSubmit={create} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_1fr_auto]">
          <input
            className="rounded-xl border border-slate-200 px-3 py-2.5"
            placeholder="عنوان المشروع"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
          />
          <input
            className="rounded-xl border border-slate-200 px-3 py-2.5"
            placeholder="وصف مختصر (اختياري)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
          />
          <button type="submit" disabled={busy} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? 'جارٍ الإنشاء…' : 'إنشاء'}
          </button>
        </form>
      )}

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-semibold text-slate-700">لا مشاريع بعد</p>
          <p className="mt-1 text-sm text-slate-500">أنشئ مشروعاً أولاً، ثم أضف سبورة داخل المشروع.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/app/projects/${project.id}`}
              className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-emerald-300 hover:shadow-elev-2"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-slate-900 group-hover:text-emerald-700">{project.title}</h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                  {new Date(project.updatedAt).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 min-h-10 text-sm text-slate-500">{project.description || 'بدون وصف'}</p>
              <span className="mt-4 inline-flex text-xs font-semibold text-emerald-700">فتح المشروع ←</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
