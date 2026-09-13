import React from 'react';
import { MButton } from './ui';

interface HomeScreenProps {
  language: string;
  onStart: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ language, onStart }) => {
  const isAr = language.toLowerCase().startsWith('ar');
  return (
    <div className="w-full h-screen bg-gradient-to-b from-tonal/50 via-white to-white flex items-center justify-center overflow-hidden relative">
      {/* Subtle dot grid */}
      <div
        className="absolute inset-0 opacity-40"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(108,92,231,.14) 1px, transparent 1.4px)', backgroundSize: '26px 26px' }}
      />
      <div className="relative z-10 max-w-xl w-full px-6 text-center animate-fade-in">
        <div className="mx-auto mb-8 w-24 h-24 rounded-[2rem] bg-gradient-to-br from-[#7c6cff] to-[#4a3f9e] text-white flex items-center justify-center shadow-elev-12 rotate-3 border border-white/20">
          <span className="material-symbols-rounded text-6xl ms-fill drop-shadow-lg">cast_for_education</span>
        </div>
        <h1 className={`text-5xl sm:text-6xl mb-3 ${isAr ? 'cinematic-hero-ar' : 'cinematic-hero'}`}>SmartBoard<span className={isAr ? '' : 'opacity-60'}> AI</span></h1>
        <p className={`text-on-surface/60 leading-relaxed mb-10 text-base sm:text-lg ${isAr ? 'font-body' : 'font-body'}`}>
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
        <div className="flex items-center justify-center gap-2 mt-8 text-[11px] text-on-surface/40 uppercase tracking-widest font-body">
          <span>Whiteboard</span><span className="text-primary">·</span><span>AI Teacher</span><span className="text-primary">·</span><span>Atlas</span><span className="text-primary">·</span><span>Smart Lab</span>
        </div>
      </div>
      <div className="absolute bottom-5 text-xs text-on-surface/30 font-mono">SmartBoard AI</div>
    </div>
  );
};

export default HomeScreen;