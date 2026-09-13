import React from 'react';
import { BoardMode, SlideData } from '../types';

interface SlideRailProps {
  mode: BoardMode;
  slides: SlideData[];
  currentIndex: number;
  onSwitchMode: (m: BoardMode) => void;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onDelete: (index: number) => void;
  language: string;
  isRunning?: boolean;
}

const SlideRail: React.FC<SlideRailProps> = ({
  mode,
  slides,
  currentIndex,
  onSwitchMode,
  onSelect,
  onAdd,
  onDelete,
  language,
  isRunning = false,
}) => {
  const isAr = language.toLowerCase().startsWith('ar');
  const maxVisible = 12;

  const modeBtn = (m: BoardMode, icon: string, label: string) => (
    <button
      onClick={() => onSwitchMode(m)}
      className={`mat-btn px-3 py-1.5 rounded-full text-xs font-medium inline-flex items-center gap-1.5 transition-all ${
        mode === m ? 'bg-primary text-white shadow-elev-1' : 'text-on-surface/70 hover:bg-surface-variant/70'
      }`}
    >
      <span className="material-symbols-rounded text-base leading-none">{icon}</span>
      {label}
    </button>
  );

  return (
    <div className="pointer-events-auto bg-white/90 backdrop-blur rounded-full shadow-elev-2 border border-black/5 px-3 py-1.5 flex items-center gap-2">
      {modeBtn('infinite', 'workspaces', isAr ? 'لانهائية' : 'Infinite')}
      {modeBtn('slides', 'view_carousel', isAr ? 'شرائح' : 'Slides')}

      {mode === 'slides' && (
        <>
          <div className="w-px h-5 bg-black/10 mx-0.5" />
          <div className="flex items-center gap-1 overflow-x-auto max-w-[38vw] scroll-thin">
            {slides.slice(0, maxVisible).map((s, i) => (
              <button
                key={s.id}
                onClick={() => onSelect(i)}
                title={`${s.name}${(s.nodes?.length || 0) + (s.edges?.length || 0) > 0 ? ` (${(s.nodes?.length || 0)} عناصر)` : ''}`}
                className={`mat-btn w-7 h-7 rounded-full text-xs font-semibold flex items-center justify-center transition-all shrink-0 ${
                  i === currentIndex
                    ? 'bg-secondary text-white shadow-elev-1'
                    : 'text-on-surface/60 hover:bg-surface-variant'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <button
            onClick={onAdd}
            title={isAr ? 'شريحة جديدة' : 'New slide'}
            className="mat-btn w-7 h-7 rounded-full text-on-surface/70 hover:bg-surface-variant flex items-center justify-center text-lg leading-none"
          >
            <span className="material-symbols-rounded text-lg">add_circle</span>
          </button>
          {slides.length > 1 && (
            <button
              onClick={() => onDelete(currentIndex)}
              title={isAr ? 'حذف الشريحة' : 'Delete slide'}
              className="mat-btn w-7 h-7 rounded-full text-on-surface/50 hover:bg-error/10 hover:text-error flex items-center justify-center"
            >
              <span className="material-symbols-rounded text-lg">delete</span>
            </button>
          )}
          <div className="w-px h-5 bg-black/10 mx-0.5" />
          <div className="mat-btn flex items-center gap-1.5 px-2 py-1 rounded-full bg-surface-variant/50 text-xs text-on-surface/70">
            <span className="material-symbols-rounded text-base text-secondary leading-none">collections_bookmark</span>
            <span className="font-semibold tabular-nums text-on-surface">
              {Math.min(currentIndex, slides.length - 1) + 1}
              <span className="text-on-surface/40"> / {slides.length}</span>
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default SlideRail;