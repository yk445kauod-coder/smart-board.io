import React from 'react';
import { MButton } from './ui';

interface HomeScreenProps {
  language: string;
  onStart: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ language, onStart }) => {
  const isAr = language.toLowerCase().startsWith('ar');
  return (
    <div className="w-full h-screen bg-gradient-to-b from-[#0b2142] via-[#142d55] to-[#081a34] flex items-center justify-center overflow-hidden relative">
      {/* Subtle dot grid */}
      <div
        className="absolute inset-0 opacity-40"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(117,203,255,.18) 1px, transparent 1.4px)', backgroundSize: '26px 26px' }}
      />
      <div className="relative z-10 max-w-xl w-full px-6 text-center animate-fade-in">
        <div className="mx-auto mb-8 w-28 h-28 rounded-[2rem] bg-white/10 flex items-center justify-center shadow-2xl rotate-3 border border-white/20 overflow-hidden">
          <img src="/smartboard-logo.png" alt="SmartBoard AI" className="w-full h-full object-contain" />
        </div>
        <h1 className={`text-5xl sm:text-6xl mb-3 ${isAr ? 'cinematic-hero-ar' : 'cinematic-hero'}`}>SmartBoard<span className={isAr ? '' : 'opacity-60'}> AI</span></h1>
        <p className={`text-white/70 leading-relaxed mb-10 text-base sm:text-lg ${isAr ? 'font-body' : 'font-body'}`}>
          {isAr
            ? 'سبورتانا الذكية — لوحة صفية بمساعد ذكاء اصطناعي يدير اللوحة معك.'
            : 'A clean AI-powered classroom whiteboard. Your AI teacher builds, explains and teaches — right on the board.'}
        </p>
        <div className="flex gap-3 justify-center flex-wrap items-center">
          <MButton onClick={onStart} className="!px-9 !py-4 !text-lg font-display">
            {isAr ? 'ابدأ' : 'Enter Workspace'}
            <span className="material-symbols-rounded text-xl ms-fill">arrow_forward</span>
          </MButton>
        </div>
        <div className="flex items-center justify-center gap-2 mt-8 text-[11px] text-white/45 uppercase tracking-widest font-body">
          <span>Whiteboard</span><span className="text-primary">·</span><span>AI Teacher</span><span className="text-primary">·</span><span>Atlas</span><span className="text-primary">·</span><span>Smart Lab</span>
        </div>
      </div>
      <div className="absolute bottom-5 text-xs text-white/30 font-mono">SmartBoard AI</div>
    </div>
  );
};

export default HomeScreen;
