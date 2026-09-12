import React, { useState } from 'react';
import { TeacherPersona, TeachingMode, KnowledgeDoc } from '../types';
import { parsePdfFile } from '../services/knowledge';
import { MButton, MInput } from './ui';

interface SmartOnboardingProps {
  language: string;
  subject: string;
  customSubjects: string[];
  newSubjectInput: string;
  onSubjectChange: (subject: string) => void;
  onLanguageChange: (lang: string) => void;
  onNewSubjectInput: (v: string) => void;
  onAddSubject: () => void;
  onStart: (opts: { name: string; mode: TeachingMode; topic: string; file: KnowledgeDoc | null }) => void;
}

const STEPS: { icon: string; ar: string; en: string }[] = [
  { icon: 'language', ar: 'اللغة', en: 'Language' },
  { icon: 'school', ar: 'طريقة التدريس', en: 'Teaching mode' },
  { icon: 'badge', ar: 'اسم المعلّم', en: 'Teacher name' },
  { icon: 'menu_book', ar: 'المادة', en: 'Subject' },
  { icon: 'edit_note', ar: 'الدرس / الموضوع', en: 'Lesson / topic' },
  { icon: 'folder_open', ar: 'المواد التعليمية', en: 'Educational material' },
];

const LANGUAGES = ['Arabic', 'English', 'French', 'Italian'];

const SmartOnboarding: React.FC<SmartOnboardingProps> = ({
  language,
  subject,
  customSubjects,
  newSubjectInput,
  onSubjectChange,
  onLanguageChange,
  onNewSubjectInput,
  onAddSubject,
  onStart,
}) => {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<TeachingMode>('classroom');
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [file, setFile] = useState<KnowledgeDoc | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  const isAr = language.toLowerCase().startsWith('ar');
  const t = (ar: string, en: string) => (isAr ? ar : en);

  const modes: { id: TeachingMode; icon: string; ar: string; en: string }[] = [
    { id: 'classroom', icon: 'school', ar: 'فصل دراسي', en: 'Classroom' },
    { id: 'online', icon: 'laptop_mac', ar: 'عبر الإنترنت', en: 'Online' },
    { id: 'self-study', icon: 'self_improvement', ar: 'تعليم ذاتي', en: 'Self-study' },
  ];

  const handleFile = async (f: File) => {
    setIsParsing(true);
    try {
      if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
        const parsed = await parsePdfFile(f);
        const doc: KnowledgeDoc = {
          id: 'kb-' + Date.now(),
          name: f.name,
          kind: 'pdf',
          text: parsed.text,
          pages: parsed.pages,
          addedAt: Date.now(),
        };
        (window as any).__smartboardPdfText = doc.text;
        (window as any).__smartboardPdfPages = Array.from({ length: doc.pages || 0 }, (_, i) => i + 1);
        setFile(doc);
      } else {
        const text = await f.text();
        setFile({ id: 'kb-' + Date.now(), name: f.name, kind: 'text', text, addedAt: Date.now() });
      }
    } catch (e) {
      console.error('Upload failed', e);
    } finally {
      setIsParsing(false);
    }
  };

  const canNext = step !== 4 || !!subject;
  const canStart = !!language;

  return (
    <div className="w-full h-screen bg-surface-variant/30 flex flex-col items-center justify-center p-4 overflow-y-auto scroll-thin" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="max-w-xl w-full bg-white rounded-3xl shadow-elev-2 p-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-elev-1">
            <span className="material-symbols-rounded">cast_for_education</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-on-surface">{t('تجربة سريعة', 'Quick setup')}</h1>
            <p className="text-sm text-on-surface/50">{t('خطوات قليلة لتجهيز السبورة والمعلم الذكي', 'A few steps to configure the board and AI teacher')}</p>
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between mt-6 mb-6">
          {STEPS.map((s, i) => {
            const n = i + 1;
            const done = n < step;
            const active = n === step;
            return (
              <div key={n} className="flex items-center flex-1 last:flex-none">
                <button
                  onClick={() => n < step && setStep(n)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all border-2 ${
                    active
                      ? 'bg-primary text-white border-primary scale-110 shadow-elev-1'
                      : done
                        ? 'bg-tonal text-[#4a3f9e] border-primary/40'
                        : 'bg-surface-variant/40 text-on-surface/40 border-black/10'
                  }`}
                  title={t(s.ar, s.en)}
                >
                  {done ? <span className="material-symbols-rounded text-sm ms-fill">check</span> : n}
                </button>
                {n < STEPS.length && <div className={`flex-1 h-0.5 mx-1.5 ${n < step ? 'bg-primary/50' : 'bg-black/10'}`} />}
              </div>
            );
          })}
        </div>

        {/* Step title */}
        <h2 className="text-lg font-semibold text-on-surface mb-5 flex items-center gap-2.5">
          <span className="material-symbols-rounded text-primary">{STEPS[step - 1].icon}</span>
          {t(STEPS[step - 1].ar, STEPS[step - 1].en)}
        </h2>

        {/* Step content */}
        {step === 1 && (
          <div className="grid grid-cols-2 gap-3">
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                onClick={() => onLanguageChange(lang)}
                className={`mat-btn px-4 py-3.5 rounded-2xl border-2 font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                  language === lang ? 'bg-tonal border-primary text-[#4a3f9e]' : 'bg-surface-variant/40 border-black/10 text-on-surface/70 hover:border-primary/50'
                }`}
              >
                <span className={`text-base font-bold ${lang === 'Arabic' ? 'font-ar' : 'font-en'}`}>{lang}</span>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {modes.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`mat-btn p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                  mode === m.id ? 'bg-tonal border-primary text-[#4a3f9e]' : 'bg-surface-variant/40 border-black/10 text-on-surface/70 hover:border-primary/50'
                }`}
              >
                <span className="material-symbols-rounded text-3xl">{m.icon}</span>
                <span className="text-sm font-medium text-center">{t(m.ar, m.en)}</span>
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <MInput
            value={name}
            onChange={setName}
            placeholder={t('اسمك — اختياري', 'Your name — optional')}
          />
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {customSubjects.map((subj) => (
                <button
                  key={subj}
                  onClick={() => onSubjectChange(subj)}
                  className={`mat-btn px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                    subject === subj ? 'bg-primary text-white border-primary shadow-elev-1' : 'bg-white border-black/10 text-on-surface/70 hover:border-primary/50'
                  }`}
                >
                  {subj}
                </button>
              ))}
            </div>
            <div className="flex gap-2 items-center bg-surface-variant/40 p-2 rounded-2xl border border-black/10">
              <input
                type="text"
                value={newSubjectInput}
                onChange={(e) => onNewSubjectInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onAddSubject()}
                placeholder={t('أضف مادة جديدة...', 'Add a new subject...')}
                className="flex-1 bg-transparent outline-none px-2 text-sm text-on-surface"
              />
              <button onClick={onAddSubject} disabled={!newSubjectInput.trim()} className="mat-btn px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-40">
                {t('حفظ', 'Add')}
              </button>
            </div>
          </div>
        )}

        {step === 5 && (
          <MInput
            value={topic}
            onChange={setTopic}
            multiline
            rows={3}
            placeholder={t('مثال: دورة الماء في الطبيعة — اختياري', 'e.g., the water cycle — optional')}
          />
        )}

        {step === 6 && (
          <div>
            <label className="block p-6 rounded-2xl border-2 border-dashed border-black/15 bg-surface-variant/30 hover:border-primary cursor-pointer text-center transition-colors">
              <div className="flex flex-col items-center gap-2">
                <span className={`material-symbols-rounded text-4xl ${file ? 'text-green-600 ms-fill text-primary' : 'text-on-surface/40'}`}>
                  {isParsing ? 'progress_activity' : file ? 'task_alt' : 'upload_file'}
                </span>
                {isParsing ? (
                  <span className="text-sm text-on-surface/60">{t('جارٍ قراءة الملف...', 'Reading file...')}</span>
                ) : file ? (
                  <div>
                    <p className="font-medium text-sm text-on-surface truncate max-w-[20rem]">{file.name}</p>
                    <p className="text-xs text-on-surface/40">{file.pages ?? 0} {t('صفحة', 'pages')} · {file.text.length} {t('حرف', 'chars')}</p>
                  </div>
                ) : (
                  <span className="text-sm text-on-surface/60">
                    {t('PDF أو كتاب أو نص تعليمي — اختياري', 'PDF, book, or educational text — optional')}
                  </span>
                )}
              </div>
              <input
                type="file"
                accept=".pdf,.txt,application/pdf,text/plain"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        )}

        {/* Nav */}
        <div className="flex items-center justify-between gap-3 border-t border-black/5 pt-5 mt-6">
          <MButton variant="outline" onClick={() => setStep((s) => Math.max(1, s - 1))} className={step === 1 ? 'invisible' : ''}>
            <span className="material-symbols-rounded text-base">arrow_back</span>
            {t('السابق', 'Back')}
          </MButton>

          {step < STEPS.length ? (
            <MButton onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
              {t('التالي', 'Next')}
              <span className="material-symbols-rounded text-base">arrow_forward</span>
            </MButton>
          ) : (
            <MButton onClick={() => onStart({ name, mode, topic, file })} disabled={!canStart} className="!px-6">
              <span className="material-symbols-rounded text-base ms-fill">rocket_launch</span>
              {t('ابدأ التدريس', 'Start Teaching')}
            </MButton>
          )}
        </div>
      </div>
    </div>
  );
};

export default SmartOnboarding;