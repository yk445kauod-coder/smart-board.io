import React, { useState } from 'react';
import { TeacherPersona, TeachingMode, KnowledgeDoc } from '../types';
import { parsePdfFile } from '../services/knowledge';

interface OnboardingProps {
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

const Onboarding: React.FC<OnboardingProps> = ({
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

  const languages = ['Arabic', 'English', 'French', 'Italian'];
  const isAr = language.toLowerCase().startsWith('ar');
  const modes: { id: TeachingMode; icon: string; label: string }[] = [
    { id: 'classroom', icon: 'fa-school', label: isAr ? 'فصل دراسي' : 'Classroom' },
    { id: 'online', icon: 'fa-laptop', label: isAr ? 'عبر الإنترنت' : 'Online' },
    { id: 'self-study', icon: 'fa-user-graduate', label: isAr ? 'تعليم ذاتي' : 'Self-study' },
  ];

  const titles: string[] = isAr
    ? ['اختر اللغة', 'طريقة التدريس', 'اسم المعلّم', 'المادة', 'الدرس / الموضوع', 'المواد التعليمية']
    : ['Choose language', 'Teaching mode', 'Teacher name', 'Subject', 'Lesson / topic', 'Educational material'];

  const handleFile = async (f: File) => {
    if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
      try {
        const parsed = await parsePdfFile(f);
        const doc: KnowledgeDoc = { id: 'kb-' + Date.now(), name: f.name, kind: 'pdf', text: parsed.text, pages: parsed.pages, addedAt: Date.now() };
        (window as any).__smartboardPdfText = doc.text;
        (window as any).__smartboardPdfPages = Array.from({ length: doc.pages || 0 }, (_, i) => i + 1);
        setFile(doc);
      } catch (e) { console.error('PDF parse failed', e); }
    } else {
      const text = await f.text();
      setFile({ id: 'kb-' + Date.now(), name: f.name, kind: 'text', text, addedAt: Date.now() });
    }
  };

  return (
    <div className="w-full h-screen bg-[#fdfbf7] flex flex-col items-center justify-center text-center p-4 animate-fade-in overflow-y-auto">
      <div className="max-w-2xl w-full bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
        <h2 className="text-3xl font-bold mb-2 text-gray-800"><i className="fa-solid fa-school text-indigo-500"></i> {isAr ? 'تجهيز الصف' : 'Setup Class'}</h2>
        <p className="text-sm text-gray-400 mb-6">{isAr ? 'خطوات سريعة لتهيئة السبورة والمعلّم الآلي' : 'A quick setup to configure the board and AI teacher'}</p>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3, 4, 5, 6].map((s) => (
            <button
              key={s}
              onClick={() => { if (s < step) setStep(s); }}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${s === step ? 'bg-indigo-600 text-white border-indigo-600 scale-110' : s < step ? 'bg-indigo-100 text-indigo-600 border-indigo-400' : 'bg-gray-50 text-gray-400 border-gray-200'}`}
            >
              {s}
            </button>
          ))}
        </div>

        <h3 className="text-xl font-semibold mb-6 text-gray-700">{titles[step - 1]}</h3>

        {step === 1 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {languages.map(lang => (
              <button
                key={lang}
                onClick={() => onLanguageChange(lang)}
                className={`px-4 py-3 rounded-xl border-2 text-lg font-medium transition-all ${language === lang ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-indigo-400'}`}
              >
                {lang}
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {modes.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`p-6 rounded-2xl border-2 transition-all ${mode === m.id ? 'bg-indigo-50 border-indigo-500 text-indigo-800' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-indigo-300'}`}
              >
                <i className={`fa-solid ${m.icon} text-3xl mb-3 block`}></i>
                <span className="block font-semibold">{m.label}</span>
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="mb-6">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isAr ? 'اسمك  — اختياري...' : 'Your name — optional....'}
              className="w-full px-5 py-4 rounded-xl border border-gray-300 text-lg focus:border-indigo-500 outline-none text-gray-800"
            />
          </div>
        )}

        {step === 4 && (
          <div className="mb-6">
            <div className="flex flex-wrap gap-3 mb-4 justify-center">
              {customSubjects.map(subj => (
                <button
                  key={subj}
                  onClick={() => onSubjectChange(subj)}
                  className={`px-5 py-2 rounded-full border transition-all shadow-sm ${subject === subj ? 'bg-indigo-100 border-indigo-500 text-indigo-800 font-bold' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                >
                  {subj}
                </button>
              ))}
            </div>
            <div className="flex gap-2 items-center bg-gray-50 p-2 rounded-xl border border-gray-200 max-w-md mx-auto">
              <i className="fa-solid fa-plus text-gray-400 ml-2"></i>
              <input
                type="text"
                value={newSubjectInput}
                onChange={(e) => onNewSubjectInput(e.target.value)}
                placeholder={isAr ? 'أضف مادة جديدة...' : 'Add new subject...'}
                className="flex-1 bg-transparent outline-none text-gray-700"
                onKeyDown={(e) => e.key === 'Enter' && onAddSubject()}
              />
              <button onClick={onAddSubject} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50" disabled={!newSubjectInput.trim()}>
                {isAr ? 'حفظ' : 'Save & Add'}
              </button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="mb-6">
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={isAr ? 'مثال: دورة الماء في الطبيعة (اختياري)' : 'e.g., the water cycle in nature — optional.'}
              rows={3}
              className="w-full px-5 py-4 rounded-xl border border-gray-300 text-lg focus:border-indigo-500 outline-none text-gray-800 resize-none"
            />
          </div>
        )}

        {step === 6 && (
          <div className="mb-6">
            <label className="block p-6 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 hover:border-indigo-400 cursor-pointer text-center">
              <i className={`fa-solid ${file ? 'fa-file-circle-check' : 'fa-file-arrow-up'} text-3xl text-indigo-400 mb-3 block`}></i>
              {file ? (
                <span className="font-medium text-gray-700 truncate block">{file.name}</span>
              ) : (
                <span className="text-gray-500">{isAr ? 'PDF أو كتاب أو مادة تعليمية (اختياري) — انقر للاختيار' : 'PDF, bookor educational material(optional) — click to browse'}</span>
              )}
              <input type="file" accept=".pdf,.txt,application/pdf,text/plain" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
            </label>
          </div>
        )}

        {/* Nav */}
        <div className="flex items-center justify-between gap-4 border-t pt-6">
          <button
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={step === 1}
            className="px-5 py-2 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            <i className="fa-solid fa-arrow-left mr-2"></i>{isAr ? 'السابق' : 'Back'}
          </button>
          {step < 6 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              className="px-6 py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
            >
              {isAr ? 'التالي' : 'Next'}<i className="fa-solid fa-arrow-right ml-2"></i>
            </button>
          ) : (
            <button
              onClick={() => onStart({ name, mode, topic, file })}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-[#00E5FF] to-[#D946EF] text-black text-lg font-bold shadow-lg hover:brightness-110"
            >
              <i className="fa-solid fa-rocket mr-2"></i>{isAr ? 'ابدأ التدريس' : 'Start Teaching'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;