import React, { useState } from 'react';
import { ToolType, BoardTheme } from '../types';
import { IconBtn, ToolSeparator } from './ui';
import { THEME_LIST } from '../data/themes';

export const SHAPES: { id: string; icon: string; labelAr: string; labelEn: string }[] = [
  { id: 'rectangle', icon: 'crop_square', labelAr: 'مستطيل', labelEn: 'Rectangle' },
  { id: 'ellipse', icon: 'circle', labelAr: 'دائرة', labelEn: 'Ellipse' },
  { id: 'circle', icon: 'radio_button_unchecked', labelAr: 'دائرة مفرغة', labelEn: 'Circle' },
  { id: 'triangle', icon: 'change_history', labelAr: 'مثلث', labelEn: 'Triangle' },
  { id: 'diamond', icon: 'diamond', labelAr: 'معين', labelEn: 'Diamond' },
  { id: 'hexagon', icon: 'hexagon', labelAr: 'سداسي', labelEn: 'Hexagon' },
  { id: 'line', icon: 'horizontal_rule', labelAr: 'خط', labelEn: 'Line' },
  { id: 'arrow', icon: 'arrow_outward', labelAr: 'سهم', labelEn: 'Arrow' },
];

export interface ToolbarProps {
  activeTool: ToolType;
  setActiveTool: (t: ToolType) => void;
  isRunning: boolean;
  onToggleRun: () => void;
  onToggleChat: () => void;
  onTogglePdf: () => void;
  onOpenSettings: () => void;
  onClearBoard: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  language: string;
  isMuted: boolean;
  onToggleMute: () => void;
  onAddNote: () => void;
  onAddText: () => void;
  hasSelected?: boolean;
  // New classroom tools
  onOpenAtlas: () => void;
  onOpenLab: () => void;
  boardTheme: BoardTheme;
  onSelectTheme: (t: BoardTheme) => void;
  activeShape: string;
  onSelectShape: (s: string) => void;
  penColor: string;
}

const BottomToolbar: React.FC<ToolbarProps> = ({
  activeTool,
  setActiveTool,
  isRunning,
  onToggleRun,
  onToggleChat,
  onTogglePdf,
  onOpenSettings,
  onClearBoard,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  language,
  isMuted,
  onToggleMute,
  onAddNote,
  onAddText,
  onOpenAtlas,
  onOpenLab,
  boardTheme,
  onSelectTheme,
  activeShape,
  onSelectShape,
  penColor,
}) => {
  const isAr = language.toLowerCase().startsWith('ar');
  const toolBtn = (id: ToolType, icon: string, label: string) => (
    <IconBtn label={label} icon={icon} active={activeTool === id} onClick={() => setActiveTool(id)} />
  );

  const shapeLabel = SHAPES.find(s => s.id === activeShape);
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);

  return (
    <div className="pointer-events-auto w-full flex justify-center pb-3 relative">
      <div className="bg-white/95 backdrop-blur rounded-3xl shadow-elev-3 border border-black/5 px-2.5 py-2 flex items-center gap-0.5 flex-wrap justify-center max-w-[calc(100vw-1rem)]">
        {/* Draw tools */}
        {toolBtn('pen', 'edit', isAr ? 'القلم' : 'Pen')}
        {toolBtn('highlighter', 'border_color', isAr ? 'قلم التظليل' : 'Highlighter')}
        {toolBtn('eraser', 'ink_eraser', isAr ? 'الممحاة' : 'Eraser')}
        <ToolSeparator />
        {toolBtn('pointer', 'near_me', isAr ? 'تحديد' : 'Select')}
        {toolBtn('pan', 'pan_tool_alt', isAr ? 'تحريك' : 'Pan')}
        <ToolSeparator />
        {toolBtn('add-note', 'sticky_note_2', isAr ? 'ملاحظة' : 'Note')}
        {toolBtn('add-text', 'text_fields', isAr ? 'نص' : 'Text')}

        {/* Shape picker (drop-down) */}
        <div className="relative">
          <button
            onClick={() => { setShapeMenuOpen(v => !v); setThemeMenuOpen(false); }}
            title={isAr ? 'أشكال' : 'Shapes'}
            className={`mat-btn flex flex-col items-center justify-center gap-0.5 rounded-xl px-2.5 py-2 transition-all select-none ${
              activeTool === 'add-shape'
                ? 'mat-btn--active shadow-elev-1'
                : 'text-on-surface/80 hover:bg-surface-variant/70'
            }`}
          >
            <span className="material-symbols-rounded leading-none">{shapeLabel?.icon || 'category'}</span>
            <span className="text-[9px] leading-none opacity-70">{isAr ? 'أشكال' : 'Shapes'}</span>
          </button>
          {shapeMenuOpen && (
            <div className="absolute bottom-full mb-2 -start-2 z-50 bg-white/98 rounded-2xl shadow-elev-3 border border-black/5 p-2 grid grid-cols-4 gap-1 w-[220px] animate-fade-in">
              {SHAPES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { onSelectShape(s.id); setActiveTool('add-shape'); setShapeMenuOpen(false); }}
                  title={`${s.labelAr} / ${s.labelEn}`}
                  className={`mat-btn flex flex-col items-center gap-0.5 rounded-xl px-2 py-2 ${activeShape === s.id && activeTool === 'add-shape' ? 'bg-tonal text-[#4a3f9e]' : 'hover:bg-surface-variant/70'}`}
                >
                  <span className="material-symbols-rounded text-lg">{s.icon}</span>
                  <span className="text-[9px]">{isAr ? s.labelAr : s.labelEn}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <ToolSeparator />

        {/* Undo / Redo */}
        <IconBtn label={isAr ? 'تراجع' : 'Undo'} icon="undo" onClick={onUndo} disabled={!canUndo} />
        <IconBtn label={isAr ? 'إعادة' : 'Redo'} icon="redo" onClick={onRedo} disabled={!canRedo} />
        <ToolSeparator />

        {/* Classroom panels: Atlas + Smart Lab */}
        <button
          onClick={onOpenAtlas}
          title={isAr ? 'الأطلس — الخرائط' : 'Atlas — Maps'}
          className={`mat-btn flex flex-col items-center justify-center gap-0.5 rounded-xl px-2.5 py-2 transition-all select-none ${
            activeTool === 'atlas' ? 'mat-btn--active shadow-elev-1' : 'text-on-surface/80 hover:bg-surface-variant/70'
          }`}
        >
          <span className="material-symbols-rounded leading-none text-[19px]">map</span>
          <span className="text-[9px] leading-none opacity-70">{isAr ? 'الأطلس' : 'Atlas'}</span>
        </button>
        <button
          onClick={onOpenLab}
          title={isAr ? 'المعمل الذكي — الجدول الدوري' : 'Smart Lab — Chemistry'}
          className={`mat-btn flex flex-col items-center justify-center gap-0.5 rounded-xl px-2.5 py-2 transition-all select-none ${
            activeTool === 'lab' ? 'mat-btn--active shadow-elev-1' : 'text-on-surface/80 hover:bg-surface-variant/70'
          }`}
        >
          <span className="material-symbols-rounded leading-none text-[19px]">science</span>
          <span className="text-[9px] leading-none opacity-70">{isAr ? 'المعمل' : 'Lab'}</span>
        </button>
        <ToolSeparator />

        {/* Board tools */}
        <IconBtn label={isAr ? 'PDF' : 'PDF'} icon="picture_as_pdf" onClick={onTogglePdf} />
        <IconBtn label={isAr ? 'المعلم الذكي' : 'AI Teacher'} icon="smart_toy" onClick={onToggleChat} className="text-primary" />
        <IconBtn label={isAr ? 'الصوت' : (isMuted ? 'Unmute' : 'Mute')} icon={isMuted ? 'volume_off' : 'volume_up'} onClick={onToggleMute} active={isMuted} />

        {/* Theme picker */}
        <div className="relative">
          <button
            onClick={() => { setThemeMenuOpen(v => !v); setShapeMenuOpen(false); }}
            title={isAr ? 'لون السبورة' : 'Board color'}
            className="mat-btn flex items-center justify-center rounded-xl px-2 py-2 hover:bg-surface-variant/70"
          >
            <span
              className="w-5 h-5 rounded-full border-2 border-black/15"
              style={{ backgroundColor: THEME_LIST.find(t => t.id === boardTheme)?.bg || '#fff' }}
            />
          </button>
          {themeMenuOpen && (
            <div className="absolute bottom-full mb-2 -start-2 z-50 bg-white/98 rounded-2xl shadow-elev-3 border border-black/5 p-2 flex gap-1.5 w-fit animate-fade-in">
              {THEME_LIST.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { onSelectTheme(t.id); setThemeMenuOpen(false); }}
                  title={`${t.ar} / ${t.en}`}
                  className={`mat-btn w-8 h-8 rounded-full border-2 ${boardTheme === t.id ? 'border-primary scale-110' : 'border-black/15'} hover:scale-105 transition-transform`}
                  style={{ backgroundColor: t.bg }}
                />
              ))}
            </div>
          )}
        </div>
        <ToolSeparator />

        {/* Run Board */}
        <button
          onClick={onToggleRun}
          title={isAr ? (isRunning ? 'إنهاء العرض' : 'تشغيل اللوحة') : isRunning ? 'Exit run' : 'Run board'}
          className={`mat-btn flex items-center gap-1.5 px-4 py-2 rounded-full font-semibold text-sm shadow-elev-1 transition-all ${
            isRunning ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-primary text-white hover:shadow-elev-2'
          }`}
        >
          <span className={`material-symbols-rounded ${isRunning ? '' : 'ms-fill'}`}>{isRunning ? 'stop' : 'play_arrow'}</span>
          {isAr ? (isRunning ? 'إنهاء' : 'شغّل اللوحة') : isRunning ? 'Exit' : 'Run'}
        </button>

        {/* More */}
        <IconBtn label={isAr ? 'المزيد' : 'More'} icon="more_vert" onClick={onOpenSettings} />
        <IconBtn label={isAr ? 'مسح' : 'Clear'} icon="delete_sweep" onClick={onClearBoard} />
      </div>
    </div>
  );
};

export default BottomToolbar;