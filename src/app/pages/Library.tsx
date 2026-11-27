import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';
import { useAuth } from '../auth';
import { useWorkspace } from '../workspace';
import type { LibraryItem, Project } from '../types';
import { ErrorNote, Splash } from '../components/Shell';

export function LibraryPage() {
  const { token } = useAuth();
  const { orgId } = useWorkspace();
  const navigate = useNavigate();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const [libraryResult, projectsResult] = await Promise.all([
        apiFetch<{ items: LibraryItem[] }>(`/api/orgs/${orgId}/library`, { token }),
        apiFetch<{ projects: Project[] }>(`/api/orgs/${orgId}/projects`, { token }),
      ]);
      setItems(libraryResult.items);
      setProjects(projectsResult.projects);
      setTarget((current) => current || projectsResult.projects[0]?.id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تحميل المكتبة');
    } finally {
      setLoading(false);
    }
  }, [orgId, token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial async fetch
    void load();
  }, [load]);

  const openItem = async (item: LibraryItem) => {
    if (item.boardId) {
      navigate(`/app/boards/${item.boardId}`);
      return;
    }
    if (!target) {
      setError('أنشئ مشروعاً أولاً لنسخ العنصر إليه');
      return;
    }
    setBusyId(item.id);
    setError(null);
    try {
      const result = await apiFetch<{ board: { id: string } }>(`/api/orgs/${orgId}/boards`, {
        method: 'POST',
        token,
        body: { projectId: target, title: item.title, doc: item.payload },
      });
      navigate(`/app/boards/${result.board.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر فتح العنصر');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (item: LibraryItem) => {
    if (!window.confirm('حذف هذا العنصر من المكتبة؟')) return;
    try {
      await apiFetch(`/api/orgs/${orgId}/library/${item.id}`, { method: 'DELETE', token });
      setItems((current) => current.filter((i) => i.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر الحذف');
    }
  };

  if (loading && items.length === 0) return <Splash label="جارٍ تحميل المكتبة…" />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">المكتبة</h1>
          <p className="text-sm text-slate-500">احفظ سبورتك كقالب وأعد استخدامها في أي مشروع.</p>
        </div>
        {projects.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            نسخ إلى مشروع:
            <select className="rounded-lg border border-slate-200 px-2 py-2" value={target} onChange={(e) => setTarget(e.target.value)}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.title}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-semibold text-slate-700">المكتبة فارغة</p>
          <p className="mt-1 text-sm text-slate-500">من داخل أي سبورة اضغط أيقونة المكتبة لحفظ نسخة هنا.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article key={item.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-slate-900">{item.title}</h2>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                  {item.kind === 'template' ? 'قالب' : 'سبورة'}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {item.payload.elements.length} عنصر · {new Date(item.createdAt).toLocaleDateString('ar-EG')}
              </p>
              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => void openItem(item)}
                  disabled={busyId === item.id}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {busyId === item.id ? '…' : item.boardId ? 'فتح السبورة' : 'نسخ إلى مشروع'}
                </button>
                <button type="button" onClick={() => void remove(item)} className="text-xs text-rose-500 hover:underline">
                  حذف
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
