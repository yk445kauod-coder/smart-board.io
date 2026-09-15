import React, { useState, useEffect } from 'react';

interface TopBarProps {
  lessonTitle: string;
  onLessonTitleChange: (title: string) => void;
  isOffline: boolean;
  language: string;
  onExportPdf: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  lessonTitle,
  onLessonTitleChange,
  isOffline,
  language,
  onExportPdf,
}) => {
  const isAr = language.toLowerCase().startsWith('ar');

  // Classroom Timer State
  const [seconds, setSeconds] = useState(300); // Default 5 mins
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    let interval: any = null;
    if (isActive && seconds > 0) {
      interval = setInterval(() => {
        setSeconds((s) => s - 1);
      }, 1000);
    } else if (seconds === 0) {
      setIsActive(false);
    }
    return () => clearInterval(interval);
  }, [isActive, seconds]);

  const toggleTimer = () => setIsActive(!isActive);
  const resetTimer = () => {
    setIsActive(false);
    setSeconds(300);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  return (
    <header className="w-full bg-[#080D1E]/90 backdrop-blur border-b border-white/10 text-white px-4 py-2 flex items-center justify-between select-none z-40 transition-all">
      {/* Right side (RTL): Brand Logo + editable Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <img
            src="/smartboard-logo.png"
            alt="SmartBoard Logo"
            className="w-8 h-8 object-contain drop-shadow"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <span className="font-bold text-sm tracking-wide bg-gradient-to-r from-[#00E5FF] to-emerald-400 bg-clip-text text-transparent font-numbers">
            SmartBoard
          </span>
          <span className="bg-[#00E5FF]/15 text-[#00E5FF] text-[10px] font-bold px-1.5 py-0.5 rounded border border-[#00E5FF]/30 font-numbers">
            v2.4
          </span>
        </div>

        <div className="h-4 w-px bg-white/20" />

        {/* Lesson Title Input */}
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-rounded text-xs text-white/50">edit_note</span>
          <input
            type="text"
            value={lessonTitle}
            onChange={(e) => onLessonTitleChange(e.target.value)}
            placeholder={isAr ? 'عنوان الدرس...' : 'Lesson Title...'}
            className="bg-transparent border-b border-transparent hover:border-white/30 focus:border-[#00E5FF] focus:bg-white/5 px-1 py-0.5 text-sm font-semibold text-white/90 focus:outline-none transition-all rounded w-40 sm:w-60 font-arabic"
          />
        </div>
      </div>

      {/* Center: Local Save Indicator + Timer */}
      <div className="flex items-center gap-4">
        {/* Offline local save indicator */}
        <div className="flex items-center gap-2 bg-[#10B981]/10 border border-[#10B981]/30 px-2.5 py-1 rounded-full text-xs text-[#10B981]">
          <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
          <span className="font-medium">{isAr ? 'تم الحفظ محلياً ✓' : 'Saved locally ✓'}</span>
        </div>

        {/* Classroom Activity Timer */}
        <div className="hidden md:flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
          <span className="material-symbols-rounded text-sm text-[#F59E0B]">timer</span>
          <span className="font-mono text-xs font-bold text-[#F59E0B] tracking-wider">
            {formatTime(seconds)}
          </span>
          <button
            onClick={toggleTimer}
            className="hover:text-[#00E5FF] text-white/80 transition-colors"
            title={isActive ? (isAr ? 'إيقاف' : 'Pause') : (isAr ? 'تشغيل' : 'Start')}
          >
            <span className="material-symbols-rounded text-base">
              {isActive ? 'pause_circle' : 'play_circle'}
            </span>
          </button>
          <button
            onClick={resetTimer}
            className="hover:text-[#00E5FF] text-white/60 transition-colors"
            title={isAr ? 'إعادة ضبط' : 'Reset'}
          >
            <span className="material-symbols-rounded text-sm">restart_alt</span>
          </button>
        </div>
      </div>

      {/* Left side: Export PDF & Fullscreen */}
      <div className="flex items-center gap-2">
        <button
          onClick={onExportPdf}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-all border border-white/10"
          title={isAr ? 'تصدير الدرس PDF' : 'Export Lesson PDF'}
        >
          <span className="material-symbols-rounded text-sm text-[#00E5FF]">picture_as_pdf</span>
          <span className="hidden sm:inline">{isAr ? 'تصدير PDF' : 'Export PDF'}</span>
        </button>

        <button
          onClick={toggleFullscreen}
          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all border border-white/10"
          title={isAr ? 'ملء الشاشة' : 'Fullscreen'}
        >
          <span className="material-symbols-rounded text-base">fullscreen</span>
        </button>
      </div>
    </header>
  );
};

export default TopBar;
