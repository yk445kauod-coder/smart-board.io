import React from 'react';
import { ToolType } from '../types';
import { IconBtn, ToolSeparator } from './ui';

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
}) => {
  const isAr = language.toLowerCase().startsWith('ar');
  const toolBtn = (id: ToolType, icon: string, label: string) => (
    <IconBtn label={label} icon={icon} active={activeTool === id} onClick={() => setActiveTool(id)} />
  );

  return (
    <div className="pointer-events-auto w-full flex justify-center pb-3">
      <div className="bg-white/95 backdrop-blur rounded-3xl shadow-elev-3 border border-black/5 px-2.5 py-2 flex items-center gap-0.5 flex-wrap justify-center max-w-[calc(100vw-1rem)]">
        {/* Draw tools */}
        {toolBtn('pen', 'edit', isAr ? 'القلم' : 'Pen')}
        {toolBtn('eraser', 'ink_eraser', isAr ? 'الممحاة' : 'Eraser')}
        <ToolSeparator />
        {toolBtn('pointer', 'near_me', isAr ? 'تحديد' : 'Select')}
        {toolBtn('pan', 'pan_tool_alt', isAr ? 'تحريك' : 'Pan')}
        <ToolSeparator />
        {toolBtn('add-note', 'sticky_note_2', isAr ? 'ملاحظة' : 'Note')}
        {toolBtn('add-text', 'text_fields', isAr ? 'نص' : 'Text')}
        {toolBtn('add-shape', 'category', isAr ? 'أشكال' : 'Shapes')}
        <ToolSeparator />

        {/* Undo / Redo */}
        <IconBtn label="Undo" icon="undo" onClick={onUndo} disabled={!canUndo} />
        <IconBtn label="Redo" icon="redo" onClick={onRedo} disabled={!canRedo} />
        <ToolSeparator />

        {/* Board tools */}
        <IconBtn label={isAr ? 'PDF' : 'PDF'} icon="picture_as_pdf" onClick={onTogglePdf} />
        <IconBtn label={isAr ? 'المعلم الذكي' : 'AI Teacher'} icon="smart_toy" onClick={onToggleChat} className="text-primary" />
        <IconBtn label={isAr ? 'الصوت' : (isMuted ? 'Unmute' : 'Mute')} icon={isMuted ? 'volume_off' : 'volume_up'} onClick={onToggleMute} active={isMuted} />
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