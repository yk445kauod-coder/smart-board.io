import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BoardDoc, emptyDoc } from '../../../shared/board/model';
import { BoardEditor, type SaveState } from '../../board/BoardEditor';
import { apiFetch, ApiError } from '../api';
import { useAuth } from '../auth';
import { useWorkspace } from '../workspace';
import { cacheGet, cacheSet } from '../idb';
import type { BoardRecord } from '../types';
import { ErrorNote, Splash } from '../components/Shell';

const GUEST_DOC_KEY = 'smartboard:guest-doc';
const GUEST_TITLE_KEY = 'smartboard:guest-title';

function parseDoc(value: unknown): BoardDoc | null {
  const parsed = BoardDoc.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function readGuestDoc(): BoardDoc {
  try {
    const raw = localStorage.getItem(GUEST_DOC_KEY);
    if (!raw) return emptyDoc();
    return parseDoc(JSON.parse(raw)) ?? emptyDoc();
  } catch {
    return emptyDoc();
  }
}

export function GuestBoardPage() {
  return <BoardScreen guest />;
}

export function BoardPage() {
  const { orgId } = useWorkspace();
  const { boardId = '' } = useParams();
  return <BoardScreen orgId={orgId} boardId={boardId} />;
}

function BoardScreen({ guest = false, orgId = '', boardId = '' }: { guest?: boolean; orgId?: string; boardId?: string }) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<BoardDoc | null>(null);
  const [title, setTitle] = useState(guest ? 'سبورة سريعة' : '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const docRef = useRef<BoardDoc | null>(null);
  const titleRef = useRef(title);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheKey = guest ? 'guest:main' : `board:${orgId}:${boardId}`;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      if (guest) {
        const initial = readGuestDoc();
        const cached = await cacheGet<BoardDoc>(cacheKey);
        const fromCache = cached ? parseDoc(cached) : null;
        const next = initial.elements.length > 0 ? initial : (fromCache ?? initial);
        if (cancelled) return;
        setDoc(next);
        docRef.current = next;
        setTitle(localStorage.getItem(GUEST_TITLE_KEY) ?? 'سبورة سريعة');
        setLoading(false);
        return;
      }
      try {
        const result = await apiFetch<{ board: BoardRecord }>(`/api/orgs/${orgId}/boards/${boardId}`, { token });
        if (cancelled) return;
        setDoc(result.board.doc);
        docRef.current = result.board.doc;
        setTitle(result.board.title);
        await cacheSet(cacheKey, result.board.doc);
      } catch (err) {
        const cached = await cacheGet<BoardDoc>(cacheKey);
        const fallback = cached ? parseDoc(cached) : null;
        if (cancelled) return;
        if (fallback) {
          setDoc(fallback);
          docRef.current = fallback;
          setTitle('نسخة محفوظة محلياً');
          setSaveState('offline');
        } else {
          setError(err instanceof Error ? err.message : 'تعذّر تحميل السبورة');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [guest, orgId, boardId, token, cacheKey]);

  const persist = useCallback(async (nextDoc: BoardDoc, nextTitle: string) => {
    setSaveState('saving');
    await cacheSet(cacheKey, nextDoc);
    if (guest) {
      try {
        localStorage.setItem(GUEST_DOC_KEY, JSON.stringify(nextDoc));
        localStorage.setItem(GUEST_TITLE_KEY, nextTitle);
        setSaveState('saved');
      } catch {
        setSaveState('error');
      }
      return;
    }
    if (!token) {
      setSaveState('offline');
      return;
    }
    try {
      await apiFetch(`/api/orgs/${orgId}/boards/${boardId}`, {
        method: 'PATCH',
        token,
        body: { doc: nextDoc, title: nextTitle },
      });
      setSaveState('saved');
    } catch (err) {
      setSaveState(err instanceof ApiError && err.status === 401 ? 'error' : 'offline');
    }
  }, [guest, cacheKey, token, orgId, boardId]);

  const onDocChange = useCallback((nextDoc: BoardDoc) => {
    docRef.current = nextDoc;
    setSaveState('dirty');
    void cacheSet(cacheKey, nextDoc);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void persist(nextDoc, titleRef.current);
    }, 1000);
  }, [cacheKey, persist]);

  const onTitleChange = (nextTitle: string) => {
    setTitle(nextTitle);
    titleRef.current = nextTitle;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (docRef.current) void persist(docRef.current, nextTitle);
    }, 1000);
  };

  useEffect(() => {
    const online = () => {
      if (saveState === 'offline' && docRef.current) void persist(docRef.current, titleRef.current);
    };
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, [saveState, persist]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const saveToLibrary = async (nextDoc: BoardDoc) => {
    if (guest || !token) return;
    const name = window.prompt('اسم العنصر في المكتبة', title || 'درس');
    if (!name) return;
    try {
      await apiFetch(`/api/orgs/${orgId}/library`, {
        method: 'POST',
        token,
        body: { title: name, kind: 'board', payload: nextDoc, boardId },
      });
      setNotice('تم الحفظ في المكتبة');
      setTimeout(() => setNotice(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر الحفظ في المكتبة');
    }
  };

  if (loading) return <Splash label="جارٍ تحميل السبورة…" />;
  if (error || !doc) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <ErrorNote>{error ?? 'السبورة غير متاحة'}</ErrorNote>
        <button type="button" className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-sm" onClick={() => navigate(guest ? '/' : '/app/projects')}>
          رجوع
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      {notice && (
        <div className="absolute left-1/2 top-16 z-40 -translate-x-1/2 rounded-full bg-emerald-600 px-4 py-2 text-sm text-white shadow-elev-3">
          {notice}
        </div>
      )}
      <BoardEditor
        key={`${guest ? 'guest' : orgId}:${boardId}`}
        initialDoc={doc}
        title={title}
        saveState={saveState}
        onTitleChange={onTitleChange}
        onDocChange={onDocChange}
        onBack={() => navigate(guest ? '/' : '/app/projects')}
        onSaveToLibrary={guest ? undefined : saveToLibrary}
      />
    </div>
  );
}
