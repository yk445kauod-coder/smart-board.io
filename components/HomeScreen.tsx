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
      <div className="relative z-10 max-w-lg w-full px-6 text-center animate-fade-in">
        <div className="mx-auto mb-8 w-20 h-20 rounded-[1.75rem] bg-primary text-white flex items-center justify-center shadow-elev-3 rotate-3">
          <span className="material-symbols-rounded text-5xl ms-fill">cast_for_education</span>
        </div>
        <h1 className="text-4xl font-bold text-on-surface mb-3">SmartBoard AI</h1>
        <p className="text-on-surface/60 leading-relaxed mb-10">
          {isAr
            ? 'سبورتانا الذكية — لوحة صفية بمساعد ذكاء اصطناعي يدير اللوحة معك.'
            : 'A clean AI-powered classroom whiteboard. Your AI teacher builds, explains and teaches — right on the board.'}
        </p>
        <MButton onClick={onStart} className="!px-8 !py-3.5 !text-base">
          {isAr ? 'ابدأ' : 'Enter Workspace'}
          <span className="material-symbols-rounded text-lg ms-fill">arrow_forward</span>
        </MButton>
      </div>
      <div className="absolute bottom-5 text-xs text-on-surface/30 font-mono">SmartBoard AI</div>
    </div>
  );
};

export default HomeScreen;