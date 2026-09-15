import React, { useState } from 'react';

interface SpotlightCurtainOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  language: string;
}

type Mode = 'curtain' | 'spotlight';

export const SpotlightCurtainOverlay: React.FC<SpotlightCurtainOverlayProps> = ({
  isOpen,
  onClose,
  language,
}) => {
  const isAr = language.toLowerCase().startsWith('ar');
  const [mode, setMode] = useState<Mode>('curtain');

  // Curtain state: height in percentage (0 = top, 100 = full cover)
  const [curtainHeight, setCurtainHeight] = useState(50);

  // Spotlight state
  const [spotPos, setSpotPos] = useState({ x: 500, y: 300 });
  const [spotRadius, setSpotRadius] = useState(140);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 pointer-events-none select-none">
      {/* Control Switcher Bar */}
      <div className="pointer-events-auto absolute top-16 left-1/2 -translate-x-1/2 bg-[#080D1E]/90 backdrop-blur border border-white/10 text-white rounded-2xl shadow-xl px-4 py-2 flex items-center gap-3 z-50">
        <span className="text-xs font-bold text-[#F59E0B] font-arabic flex items-center gap-1">
          <span className="material-symbols-rounded text-base">curtains</span>
          {isAr ? 'الستارة والكاشف' : 'Curtain & Spotlight'}
        </span>

        <div className="h-4 w-px bg-white/20" />

        <button
          onClick={() => setMode('curtain')}
          className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 ${
            mode === 'curtain' ? 'bg-[#F59E0B] text-black' : 'hover:bg-white/10 text-white/80'
          }`}
        >
          <span className="material-symbols-rounded text-sm">roller_shades</span>
          {isAr ? 'الستارة' : 'Curtain'}
        </button>

        <button
          onClick={() => setMode('spotlight')}
          className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 ${
            mode === 'spotlight' ? 'bg-[#F59E0B] text-black' : 'hover:bg-white/10 text-white/80'
          }`}
        >
          <span className="material-symbols-rounded text-sm">highlight</span>
          {isAr ? 'كاشف الإجابات' : 'Spotlight'}
        </button>

        <div className="h-4 w-px bg-white/20" />

        <button
          onClick={onClose}
          className="p-1 hover:bg-white/20 rounded-lg text-white/60 hover:text-white transition-all"
        >
          <span className="material-symbols-rounded text-sm">close</span>
        </button>
      </div>

      {/* 1. Curtain Overlay */}
      {mode === 'curtain' && (
        <div
          style={{ height: `${curtainHeight}%` }}
          className="pointer-events-auto absolute top-0 left-0 right-0 bg-[#0E1324]/95 border-b-4 border-[#F59E0B] shadow-2xl transition-all duration-75 flex flex-col justify-end items-center"
        >
          {/* Pull Handle */}
          <div
            className="mb-2 bg-[#F59E0B] text-black rounded-full px-4 py-1 text-xs font-bold shadow-md cursor-ns-resize flex items-center gap-1 font-arabic"
            onMouseDown={(e) => {
              const startY = e.clientY;
              const startH = curtainHeight;
              const onMove = (me: MouseEvent) => {
                const delta = ((me.clientY - startY) / window.innerHeight) * 100;
                setCurtainHeight(Math.max(10, Math.min(95, startH + delta)));
              };
              const onUp = () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
              };
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            }}
          >
            <span className="material-symbols-rounded text-base">unfold_more</span>
            {isAr ? 'اسحب للأسفل/الأعلى لكشف الإجابة' : 'Drag to reveal answer'}
          </div>
        </div>
      )}

      {/* 2. Spotlight Overlay */}
      {mode === 'spotlight' && (
        <div
          className="pointer-events-auto absolute inset-0 bg-black/80 cursor-move"
          onMouseDown={(e) => {
            const startX = e.clientX - spotPos.x;
            const startY = e.clientY - spotPos.y;
            const onMove = (me: MouseEvent) => {
              setSpotPos({ x: me.clientX - startX, y: me.clientY - startY });
            };
            const onUp = () => {
              window.removeEventListener('mousemove', onMove);
              window.removeEventListener('mouseup', onUp);
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
          }}
        >
          <svg className="w-full h-full">
            <defs>
              <mask id="spotlight-mask">
                <rect width="100%" height="100%" fill="white" />
                <circle cx={spotPos.x} cy={spotPos.y} r={spotRadius} fill="black" />
              </mask>
            </defs>
            <rect
              width="100%"
              height="100%"
              fill="rgba(8, 13, 30, 0.88)"
              mask="url(#spotlight-mask)"
            />
            <circle
              cx={spotPos.x}
              cy={spotPos.y}
              r={spotRadius}
              fill="none"
              stroke="#00E5FF"
              strokeWidth="3"
            />
          </svg>

          {/* Size adjustment widget */}
          <div
            style={{ left: spotPos.x - 70, top: spotPos.y + spotRadius + 15 }}
            className="absolute bg-[#080D1E] border border-white/20 text-white rounded-xl p-2 flex items-center gap-2 text-xs shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <span className="material-symbols-rounded text-sm text-[#00E5FF]">zoom_in</span>
            <input
              type="range"
              min="60"
              max="300"
              value={spotRadius}
              onChange={(e) => setSpotRadius(Number(e.target.value))}
              className="w-20 accent-[#00E5FF]"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SpotlightCurtainOverlay;
