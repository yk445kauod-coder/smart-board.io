import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  API_BASE,
  api,
  streamChat,
  type ApiUser,
  type LessonSummary,
  type ModelInfo,
} from '../src/api/client';
import { ProtocolRenderer } from '../src/protocol/renderer';
import { parseProtocolScript } from '../src/protocol/parse';
import type { ProtocolOp, ProtocolScript } from '../src/protocol/types';

interface ProtocolBoardProps {
  language?: string;
  onExit?: () => void;
}

interface NarrationStep {
  title: string;
  say: string;
}

const isArabic = (lang?: string) => !!lang && lang.toLowerCase().startsWith('ar');

const download = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const ProtocolBoard: React.FC<ProtocolBoardProps> = ({ language = 'en', onExit }) => {
  const ar = isArabic(language);
  const t = useCallback((en: string, arText: string) => (ar ? arText : en), [ar]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const rendererRef = useRef<ProtocolRenderer | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const rawRef = useRef('');
  const stepsRef = useRef(0);

  const [user, setUser] = useState<ApiUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');

  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelId, setModelId] = useState('');
  const [question, setQuestion] = useState('');
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);

  const [script, setScript] = useState<ProtocolScript | null>(null);
  const [scriptTitle, setScriptTitle] = useState('');
  const [narration, setNarration] = useState<NarrationStep[]>([]);
  const [currentSay, setCurrentSay] = useState('');
  const [opsCount, setOpsCount] = useState(0);
  const [stepsCount, setStepsCount] = useState(0);
  const [activeStep, setActiveStep] = useState(-1);

  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [lessonsOpen, setLessonsOpen] = useState(false);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const currentModel = useMemo(() => models.find((m) => m.id === modelId), [models, modelId]);

  const refreshLessons = useCallback(async () => {
    try {
      const { lessons } = await api.lessons();
      setLessons(lessons);
    } catch (e) {
      if ((e as { status?: number }).status !== 401) {
        setWarnings((prev) => [...prev, (e as Error).message].slice(-5));
      }
    }
  }, []);

  useEffect(() => {
    if (svgRef.current && !rendererRef.current) {
      rendererRef.current = new ProtocolRenderer(svgRef.current);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.models()
      .then(({ models }) => {
        if (cancelled) return;
        setModels(models);
        const savedModel = localStorage.getItem('smartboard_model');
        const preferred = models.find((m) => m.id === savedModel) || models[0];
        if (preferred) setModelId(preferred.id);
      })
      .catch((e) => setError((e as Error).message));
    api.me()
      .then(({ user }) => { if (!cancelled) setUser(user); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (user) void refreshLessons();
    else setLessons([]);
  }, [refreshLessons, user]);

  useEffect(() => {
    if (modelId) localStorage.setItem('smartboard_model', modelId);
  }, [modelId]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const renderScript = useCallback((s: ProtocolScript, upTo?: number) => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const end = Math.max(0, Math.min(upTo ?? s.steps.length - 1, s.steps.length - 1));
    renderer.reset();
    let total = 0;
    for (let i = 0; i <= end; i++) {
      for (const op of s.steps[i].ops) {
        renderer.apply(op);
        total++;
      }
    }
    setScript(s);
    setScriptTitle(s.title || '');
    setNarration(s.steps.map((step) => ({ title: step.title, say: step.say })));
    setCurrentSay(s.steps[end]?.say || '');
    setActiveStep(end);
    setStepsCount(end + 1);
    setOpsCount(total);
    stepsRef.current = end + 1;
  }, []);

  const resetBoard = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    rendererRef.current?.reset();
    rawRef.current = '';
    stepsRef.current = 0;
    setScript(null);
    setScriptTitle('');
    setNarration([]);
    setCurrentSay('');
    setOpsCount(0);
    setStepsCount(0);
    setActiveStep(-1);
    setActiveLessonId(null);
    setSaved(false);
    setWarnings([]);
    setError('');
  }, []);

  const finalize = useCallback(async () => {
    const parsed = parseProtocolScript(rawRef.current);
    if (!parsed.script) {
      if (parsed.errors.length) setWarnings((prev) => [...prev, ...parsed.errors].slice(-5));
      return;
    }
    const s = parsed.script;
    setScript(s);
    setScriptTitle(s.title || '');
    setNarration(s.steps.map((step) => ({ title: step.title, say: step.say })));
    setCurrentSay(s.steps[s.steps.length - 1]?.say || '');
    setStepsCount(s.steps.length);
    setActiveStep(s.steps.length - 1);
    if (!user) return;
    try {
      const { lesson } = await api.createLesson({ title: s.title, lang: s.lang || language, script: s });
      setActiveLessonId(lesson.id);
      setSaved(true);
      await refreshLessons();
    } catch (e) {
      setWarnings((prev) => [...prev, t('Save failed: ', 'فشل الحفظ: ') + (e as Error).message].slice(-5));
    }
  }, [language, refreshLessons, t, user]);

  const startLesson = useCallback(async (mode: 'lesson' | 'continue' = 'lesson') => {
    if (!user) { setAuthOpen(true); return; }
    if (!modelId) { setError(t('Choose a model first.', 'اختر موديل أولاً.')); return; }
    const q = question.trim();
    if (!q) return;
    setRunning(true);
    setError('');
    setWarnings([]);
    setSaved(false);
    setStatus('connecting');
    const ac = new AbortController();
    abortRef.current = ac;
    let localOps = 0;
    let started = false;
    if (mode === 'lesson') {
      rawRef.current = '';
      stepsRef.current = 0;
    }
    try {
      await streamChat({
        model: modelId,
        messages: [{ role: 'user', content: q }],
        mode,
        board: mode === 'continue' ? rendererRef.current?.getState(stepsRef.current) : undefined,
        lang: language,
        extended: true,
      }, {
        onMeta: (meta) => setStatus('streaming · ' + meta.model),
        onDelta: (text) => { rawRef.current += text; },
        onOp: (op) => {
          if (mode === 'lesson' && !started) {
            started = true;
            rendererRef.current?.reset();
            setScript(null);
            setNarration([]);
            setCurrentSay('');
            setOpsCount(0);
            setStepsCount(0);
            setActiveStep(-1);
            setActiveLessonId(null);
          }
          rendererRef.current?.apply(op as ProtocolOp);
          localOps++;
          setOpsCount(localOps);
        },
        onStep: (count) => {
          stepsRef.current = count;
          setStepsCount(count);
          setActiveStep(count - 1);
        },
        onWarning: (errs) => setWarnings((prev) => [...prev, ...errs].slice(-5)),
        onDone: () => { void finalize(); },
        onError: (err) => setError(err.message),
      }, ac.signal);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message);
    } finally {
      setRunning(false);
      setStatus('idle');
      abortRef.current = null;
    }
  }, [finalize, language, modelId, question, t, user]);

  const submitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthBusy(true);
    setAuthError('');
    try {
      const res = authMode === 'login'
        ? await api.login(authEmail, authPassword)
        : await api.register(authEmail, authPassword, authName || undefined);
      setUser(res.user);
      setAuthOpen(false);
      setAuthPassword('');
      setAuthName('');
    } catch (err) {
      setAuthError((err as Error).message);
    } finally {
      setAuthBusy(false);
    }
  };

  const logout = async () => {
    try { await api.logout(); } catch { /* the session is local too */ }
    setUser(null);
    setLessons([]);
  };

  const loadLesson = async (id: string) => {
    try {
      const { lesson } = await api.lesson(id);
      const parsed = parseProtocolScript(JSON.stringify(lesson.script));
      if (!parsed.script) {
        setError(t('This lesson is not a valid protocol script.', 'هذا الدرس ليس سكربت بروتوكول صالح.'));
        return;
      }
      renderScript(parsed.script);
      setQuestion('');
      setActiveLessonId(id);
      setSaved(true);
      setLessonsOpen(false);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const deleteLesson = async (id: string) => {
    if (!window.confirm(t('Delete this lesson?', 'تحذف هذا الدرس؟'))) return;
    try {
      await api.deleteLesson(id);
      if (activeLessonId === id) resetBoard();
      await refreshLessons();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const exportSvg = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const data = new XMLSerializer().serializeToString(clone);
    download(new Blob([data], { type: 'image/svg+xml' }), (scriptTitle || 'smartboard') + '.svg');
  };

  const exportPng = async () => {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const data = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([data], { type: 'image/svg+xml' }));
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not render the board'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 900;
    const ctx = canvas.getContext('2d');
    if (!ctx) { URL.revokeObjectURL(url); return; }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => {
      if (blob) download(blob, (scriptTitle || 'smartboard') + '.png');
    }, 'image/png');
  };

  const speak = () => {
    if (!currentSay || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(currentSay);
    u.lang = language;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
    setStatus('idle');
  };

  return (
    <div dir={ar ? 'rtl' : 'ltr'} className="flex h-screen w-screen flex-col overflow-hidden bg-[#0b1222] text-slate-100">
      <header className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-[#0b1222]/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-lg font-black text-white">S</div>
          <div>
            <div className="text-sm font-bold">SmartBoard <span className="text-cyan-300">Protocol</span></div>
            <div className="text-[11px] text-slate-400">{t('Streaming whiteboard engine', 'محرك سبورة بثّي')}</div>
          </div>
        </div>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className="max-w-[260px] rounded-xl border border-white/10 bg-[#0f172a] px-3 py-2 text-xs outline-none focus:border-cyan-400"
            aria-label={t('Model', 'الموديل')}
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
          {user ? (
            <>
              <button
                onClick={() => setLessonsOpen(true)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-white/10"
              >
                {t('Lessons', 'الدروس')} ({lessons.length})
              </button>
              <span className="hidden text-xs text-slate-400 md:inline">{user.email}</span>
              <button onClick={() => void logout()} className="rounded-xl px-3 py-2 text-xs text-slate-300 hover:bg-white/5">
                {t('Sign out', 'خروج')}
              </button>
            </>
          ) : (
            <button
              onClick={() => setAuthOpen(true)}
              className="rounded-xl bg-cyan-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400"
            >
              {t('Sign in', 'دخول')}
            </button>
          )}
          {onExit && (
            <button onClick={onExit} className="rounded-xl px-3 py-2 text-xs text-slate-300 hover:bg-white/5">
              {t('Exit', 'رجوع')}
            </button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <main className="relative flex min-h-0 flex-1 items-center justify-center bg-[radial-gradient(circle_at_20%_10%,#12304a_0%,#0b1222_45%,#070b14_100%)] p-3">
          <div className="relative aspect-[16/9] w-full max-w-[1400px] overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-white/20">
            <svg ref={svgRef} className="h-full w-full" />
            {!script && !running && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center p-8 text-center">
                <div>
                  <div className="text-5xl">🖍️</div>
                  <h2 className="mt-3 text-2xl font-bold text-slate-800">{t('What should we draw?', 'نرسم إيه النهارده؟')}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {t('Ask a question, pick a model, and watch the lesson stream onto the board.', 'اسأل سؤال، اختار موديل، وشوف الدرس بيترسم على السبورة.')}
                  </p>
                </div>
              </div>
            )}
            {running && (
              <div className="absolute bottom-4 start-4 flex items-center gap-2 rounded-full bg-slate-900/80 px-3 py-1.5 text-xs text-white backdrop-blur">
                <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
                {status} · {opsCount} {t('ops', 'أمر')}
              </div>
            )}
          </div>
        </main>

        <aside className="flex w-full shrink-0 flex-col gap-3 border-t border-white/10 bg-[#0b1222] p-3 lg:w-[380px] lg:border-s lg:border-t-0">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <label htmlFor="protocol-prompt" className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {t('Lesson prompt', 'سؤال الدرس')}
            </label>
            <textarea
              id="protocol-prompt"
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void startLesson('lesson');
              }}
              placeholder={t('Explain photosynthesis to a 12-year-old…', 'اشرح عملية البناء الضوئي لطالب 12 سنة…')}
              className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-[#0f172a] p-3 text-sm leading-6 outline-none placeholder:text-slate-600 focus:border-cyan-400"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                onClick={() => void startLesson('lesson')}
                disabled={running || !question.trim()}
                className="flex-1 rounded-xl bg-cyan-500 px-3 py-2 text-xs font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {running ? t('Teaching…', 'بيشرح…') : t('Teach', 'اشرح')}
              </button>
              {script && (
                <button
                  onClick={() => void startLesson('continue')}
                  disabled={running || !question.trim()}
                  className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-200 disabled:opacity-40"
                >
                  {t('Continue', 'كمّل')}
                </button>
              )}
              {running ? (
                <button onClick={stop} className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-200">
                  {t('Stop', 'وقف')}
                </button>
              ) : (
                <button onClick={resetBoard} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5">
                  {t('Clear', 'مسح')}
                </button>
              )}
            </div>
            <div className="mt-2 truncate text-[11px] text-slate-500">
              {t('Model', 'الموديل')}: {currentModel?.label || '—'} · API: {API_BASE}
            </div>
          </div>

          {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs leading-5 text-rose-200">{error}</div>}
          {warnings.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] leading-5 text-amber-100">
              {warnings.map((w, i) => <div key={i}>• {w}</div>)}
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t('Narration', 'الشرح')}</div>
              <button
                onClick={speak}
                disabled={!currentSay}
                className="rounded-lg px-2 py-1 text-sm hover:bg-white/10 disabled:opacity-30"
                aria-label={t('Read aloud', 'اقرأ بصوت')}
              >
                🔊
              </button>
            </div>
            <p className="mt-2 min-h-[48px] text-sm leading-6 text-slate-200">
              {currentSay || t('The narration appears here as the lesson streams.', 'الشرح بيظهر هنا مع البث.')}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {t('Steps', 'الخطوات')} ({stepsCount})
              </div>
              {saved && <span className="text-[11px] text-emerald-300">{t('Saved', 'محفوظ')}</span>}
            </div>
            <ol className="mt-2 space-y-1.5">
              {narration.map((step, i) => (
                <li key={i}>
                  <button
                    onClick={() => script && renderScript(script, i)}
                    className={
                      'w-full rounded-xl px-3 py-2 text-start text-xs transition ' +
                      (i === activeStep ? 'bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/40' : 'text-slate-300 hover:bg-white/5')
                    }
                  >
                    <span className="font-semibold">{i + 1}. {step.title || t('Step', 'خطوة')}</span>
                    <span className="mt-0.5 block text-[11px] leading-5 text-slate-400">{step.say}</span>
                  </button>
                </li>
              ))}
              {!narration.length && <li className="text-xs text-slate-500">{t('No steps yet.', 'لا توجد خطوات بعد.')}</li>}
            </ol>
          </div>

          <div className="flex gap-2">
            <button onClick={exportSvg} disabled={!script} className="flex-1 rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-30">SVG</button>
            <button onClick={() => void exportPng()} disabled={!script} className="flex-1 rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-30">PNG</button>
            <button
              onClick={() => { void navigator.clipboard.writeText(rawRef.current).catch(() => undefined); }}
              disabled={!script}
              className="flex-1 rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-30"
            >
              JSON
            </button>
          </div>
        </aside>
      </div>

      {authOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 backdrop-blur" onClick={() => !authBusy && setAuthOpen(false)}>
          <form onSubmit={submitAuth} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1222] p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold">{authMode === 'login' ? t('Welcome back', 'أهلاً بعودتك') : t('Create an account', 'اعمل حساب')}</h2>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  {t('Your lessons are stored in your own Cloudflare D1 database.', 'دروسك محفوظة في قاعدة D1 الخاصة بك على Cloudflare.')}
                </p>
              </div>
              <button type="button" onClick={() => setAuthOpen(false)} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/5">✕</button>
            </div>
            {authMode === 'register' && (
              <label className="mt-4 block text-xs text-slate-400">
                {t('Name', 'الاسم')}
                <input value={authName} onChange={(e) => setAuthName(e.target.value)} maxLength={80} className="mt-1 w-full rounded-xl border border-white/10 bg-[#0f172a] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400" />
              </label>
            )}
            <label className="mt-4 block text-xs text-slate-400">
              {t('Email', 'البريد الإلكتروني')}
              <input type="email" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} autoComplete="email" className="mt-1 w-full rounded-xl border border-white/10 bg-[#0f172a] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400" />
            </label>
            <label className="mt-3 block text-xs text-slate-400">
              {t('Password', 'كلمة المرور')}
              <input
                type="password"
                required
                minLength={authMode === 'register' ? 8 : 1}
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                className="mt-1 w-full rounded-xl border border-white/10 bg-[#0f172a] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
              />
            </label>
            {authError && <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">{authError}</div>}
            <button type="submit" disabled={authBusy} className="mt-4 w-full rounded-xl bg-cyan-500 px-3 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50">
              {authBusy ? '…' : authMode === 'login' ? t('Sign in', 'دخول') : t('Create account', 'إنشاء الحساب')}
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); }}
              className="mt-3 w-full text-xs text-cyan-300 hover:text-cyan-200"
            >
              {authMode === 'login' ? t('New here? Create an account', 'جديد؟ اعمل حساب') : t('Already have an account? Sign in', 'عندك حساب؟ سجّل دخول')}
            </button>
          </form>
        </div>
      )}

      {lessonsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur" onClick={() => setLessonsOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="h-full w-full max-w-md overflow-auto border-s border-white/10 bg-[#0b1222] p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{t('My lessons', 'دروسي')}</h2>
              <button onClick={() => setLessonsOpen(false)} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/5">✕</button>
            </div>
            <div className="mt-3 space-y-2">
              {lessons.map((lesson) => (
                <div key={lesson.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <button onClick={() => void loadLesson(lesson.id)} className="w-full text-start">
                    <div className="text-sm font-semibold">{lesson.title || t('Untitled', 'بدون عنوان')}</div>
                    <div className="text-[11px] text-slate-400">{new Date(lesson.updated_at).toLocaleString(ar ? 'ar-EG' : 'en-US')}</div>
                  </button>
                  <div className="mt-2 flex justify-end">
                    <button onClick={() => void deleteLesson(lesson.id)} className="text-[11px] text-rose-300 hover:text-rose-200">{t('Delete', 'حذف')}</button>
                  </div>
                </div>
              ))}
              {!lessons.length && <p className="text-xs text-slate-500">{t('No saved lessons yet.', 'لا توجد دروس محفوظة.')}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProtocolBoard;
