import React from 'react';
import { MButton } from './ui';

interface HomeScreenProps {
  language: string;
  onStart: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ language, onStart }) => {
  const isAr = language.toLowerCase().startsWith('ar');
  const features = isAr
    ? [
        { icon: 'edit_note', label: 'سبورة تفاعلية', detail: 'اكتب وارسم ونظّم أفكارك' },
        { icon: 'smart_toy', label: 'معلّم ذكي', detail: 'شرح بصري داخل الدرس' },
        { icon: 'science', label: 'أدوات تعليمية', detail: 'معمل وأطلس وحاسبة' },
      ]
    : [
        { icon: 'edit_note', label: 'Interactive board', detail: 'Write, draw, and organize' },
        { icon: 'smart_toy', label: 'AI teacher', detail: 'Visual help inside the lesson' },
        { icon: 'science', label: 'Classroom tools', detail: 'Lab, atlas, and calculator' },
      ];

  return (
    <div className="w-full h-screen bg-[#07152e] flex items-center justify-center overflow-hidden relative text-white">
      {/* Layered background keeps the landing screen calm without hiding the content. */}
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(117,203,255,.18) 1px, transparent 1.4px)',
          backgroundSize: '26px 26px',
        }}
      />
      <div className="absolute -top-40 -start-24 w-[32rem] h-[32rem] rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="absolute -bottom-48 -end-20 w-[34rem] h-[34rem] rounded-full bg-emerald-400/10 blur-3xl" />

      <main className="relative z-10 max-w-3xl w-full px-5 sm:px-8 py-8 text-center animate-fade-in">
        <div className="mx-auto mb-6 w-24 h-24 sm:w-28 sm:h-28 rounded-[2rem] bg-white/10 flex items-center justify-center shadow-2xl rotate-3 border border-white/20 overflow-hidden">
          <img src="/smartboard-logo.png" alt="SmartBoard AI" className="w-full h-full object-contain" />
        </div>
        <p className="text-[#72e9ff] text-[11px] sm:text-xs font-semibold uppercase tracking-[0.28em] mb-3">
          {isAr ? 'مساحة تعليم تفاعلية' : 'Interactive teaching workspace'}
        </p>
        <h1 className="text-white text-5xl sm:text-7xl font-extrabold tracking-tight leading-none mb-4 font-display">
          SmartBoard<span className="text-[#72e9ff]"> AI</span>
        </h1>
        <p className="max-w-2xl mx-auto text-white/70 leading-relaxed mb-8 text-base sm:text-lg font-body">
          {isAr
            ? 'سبورة ذكية تساعدك على الشرح والرسم وبناء الدروس — في مساحة واحدة واضحة.'
            : 'A clean AI-powered classroom whiteboard. Your AI teacher builds, explains and teaches — right on the board.'}
        </p>
        <div className="flex gap-3 justify-center flex-wrap items-center mb-8">
          <MButton onClick={onStart} className="!px-8 !py-3.5 !text-base sm:!text-lg font-display !bg-[#10b981] hover:!bg-[#34d399] !shadow-[0_12px_35px_rgba(16,185,129,.28)]">
            {isAr ? 'ابدأ' : 'Enter Workspace'}
            <span className="material-symbols-rounded text-xl ms-fill">arrow_forward</span>
          </MButton>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto text-start" dir={isAr ? 'rtl' : 'ltr'}>
          {features.map((feature) => (
            <div key={feature.label} className="rounded-2xl border border-white/10 bg-white/[.06] backdrop-blur-sm px-4 py-3 flex items-center gap-3">
              <span className="material-symbols-rounded text-[#72e9ff] text-2xl">{feature.icon}</span>
              <span className="min-w-0">
                <strong className="block text-sm text-white/90 font-semibold truncate">{feature.label}</strong>
                <span className="block text-[11px] text-white/45 truncate">{feature.detail}</span>
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 mt-8 text-[10px] text-white/35 uppercase tracking-[0.2em] font-body">
          <span>Offline-ready</span><span className="text-[#10b981]">·</span><span>Arabic / English</span><span className="text-[#10b981]">·</span><span>Built for teachers</span>
        </div>
      </main>
      <div className="absolute bottom-4 text-[10px] text-white/25 font-mono tracking-widest">SMARTBOARD AI</div>
    </div>
  );
};

export default HomeScreen;
