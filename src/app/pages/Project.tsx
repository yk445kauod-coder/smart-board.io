import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { emptyDoc } from '../../../shared/board/model';
import { apiFetch } from '../api';
import { useAuth } from '../auth';
import { useWorkspace } from '../workspace';
import type { BoardSummary, Project } from '../types';
import { ErrorNote, Splash } from '../components/Shell';

export function ProjectPage() {
  const { projectId = '' } = useParams();
  const { orgId } = useWorkspace();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!orgId || !projectId) return;
    setLoading(true);
    setError(null);
    try {
      const [projectResult, boardsResult] = await Promise.all([
        apiFetch<{ project: Project }>(`/api/orgs/${orgId}/projects/${projectId}`, { token }),
        apiFetch<{ boards: BoardSummary[] }>(`/api/orgs/${orgId}/projects/${projectId}/boards`, { token }),
      ]);
      setProject(projectResult.project);
      setBoards(boardsResult.boards);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تحميل المشروع');
    } finally {
      setLoading(false);
    }
  }, [orgId, projectId, token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial async fetch
    void load();
  }, [load]);

  const createBoard = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{ board: BoardSummary }>(`/api/orgs/${orgId}/boards`, {
        method: 'POST',
        token,
        body: { projectId, title: `سبورة ${boards.length + 1}`, doc: emptyDoc() },
      });
      navigate(`/app/boards/${result.board.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر إنشاء السبورة');
    } finally {
      setBusy(false);
    }
  };

  const deleteBoard = async (id: string) => {
    if (!window.confirm('حذف هذه السبورة نهائياً؟')) return;
    try {
      await apiFetch(`/api/orgs/${orgId}/boards/${id}`, { method: 'DELETE', token });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر حذف السبورة');
    }
  };

  const deleteProject = async () => {
    if (!window.confirm('حذف المشروع وكل سبوراته نهائياً؟')) return;
    try {
      await apiFetch(`/api/orgs/${orgId}/projects/${projectId}`, { method: 'DELETE', token });
      navigate('/app/projects');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر حذف المشروع');
    }
  };

  if (loading && !project) return <Splash label="جارٍ تحميل المشروع…" />;

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/app/projects" className="hover:text-emerald-700">المشاريع</Link>
        <span>/</span>
        <span className="text-slate-700">{project?.title ?? '…'}</span>
      </nav>

      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{project?.title ?? 'مشروع'}</h1>
          <p className="mt-1 text-sm text-slate-500">{project?.description || 'بدون وصف'}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={deleteProject} className="rounded-xl border border-rose-200 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50">
            حذف المشروع
          </button>
          <button type="button" onClick={createBoard} disabled={busy} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
            {busy ? 'جارٍ الإنشاء…' : 'سبورة جديدة'}
          </button>
        </div>
      </div>

      {boards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-semibold text-slate-700">لا سبورات في هذا المشروع</p>
          <p className="mt-1 text-sm text-slate-500">أضف سبورة وابدأ الرسم.</p>
          <button type="button" onClick={createBoard} className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
            سبورة جديدة
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <div key={board.id} className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-emerald-300 hover:shadow-elev-2">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/app/boards/${board.id}`} className="font-semibold text-slate-900 group-hover:text-emerald-700">
                  {board.title}
                </Link>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                  {new Date(board.updatedAt).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <Link to={`/app/boards/${board.id}`} className="text-xs font-semibold text-emerald-700">فتح السبورة ←</Link>
                <button type="button" onClick={() => void deleteBoard(board.id)} className="text-xs text-rose-500 hover:underline">
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
