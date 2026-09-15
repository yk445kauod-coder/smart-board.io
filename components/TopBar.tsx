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
    <header className="w-full bg-[#080D1E]/95 backdrop-blur border-b-2 border-[#00E5FF]/20 text-white px-4 py-2 flex items-center justify-between select-none z-40 transition-all font-sans">
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
          <span className="font-bold text-sm tracking-wider bg-gradient-to-r from-[#00E5FF] via-[#D946EF] to-[#F59E0B] bg-clip-text text-transparent font-numbers">
            SmartBoard
          </span>
          {/* Retro Pixel Art Chrome Badge */}
          <span className="bg-[#080D1E] text-[#00E5FF] text-[10px] font-mono font-bold px-1.5 py-0.5 border-2 border-[#00E5FF] shadow-[2px_2px_0px_0px_#00E5FF] font-numbers uppercase tracking-tight">
            v2.4
          </span>
        </div>

        <div className="h-4 w-px bg-white/20" />

        {/* Lesson Title Input */}
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-rounded text-xs text-[#00E5FF]/70">edit_note</span>
          <input
            type="text"
            value={lessonTitle}
            onChange={(e) => onLessonTitleChange(e.target.value)}
            placeholder={isAr ? 'عنوان الدرس...' : 'Lesson Title...'}
            aria-label={isAr ? 'عنوان الدرس' : 'Lesson Title'}
            className="bg-transparent border-b-2 border-white/20 hover:border-[#00E5FF]/50 focus:border-[#00E5FF] focus:bg-white/5 px-1 py-0.5 text-sm font-semibold text-white focus:outline-none focus:ring-1 focus:ring-[#00E5FF] transition-all rounded-none w-40 sm:w-60 font-arabic"
          />
        </div>
      </div>

      {/* Center: Local Save Indicator + Timer */}
      <div className="flex items-center gap-4">
        {/* Retro Pixel Chrome Offline Local Save Indicator */}
        <div className="flex items-center gap-2 bg-[#080D1E] border-2 border-[#00E5FF] shadow-[2px_2px_0px_0px_#00E5FF] px-2.5 py-0.5 text-xs text-[#00E5FF] font-mono tracking-tight font-bold">
          <span className="w-2 h-2 bg-[#00E5FF] animate-pulse" />
          <span>{isAr ? 'تم الحفظ محلياً ✓' : 'Saved locally ✓'}</span>
        </div>

        {/* Classroom Activity Timer with Pixel Shadow */}
        <div className="hidden md:flex items-center gap-2 bg-[#080D1E] border-2 border-[#F59E0B]/80 shadow-[2px_2px_0px_0px_#F59E0B] px-3 py-0.5">
          <span className="material-symbols-rounded text-sm text-[#F59E0B]">timer</span>
          <span className="font-mono text-xs font-bold text-[#F59E0B] tracking-wider">
            {formatTime(seconds)}
          </span>
          <button
            onClick={toggleTimer}
            aria-label={isActive ? (isAr ? 'إيقاف المؤقت' : 'Pause Timer') : (isAr ? 'تشغيل المؤقت' : 'Start Timer')}
            className="hover:text-[#00E5FF] text-white/80 transition-colors focus-visible:ring-1 focus-visible:ring-[#00E5FF]"
            title={isActive ? (isAr ? 'إيقاف' : 'Pause') : (isAr ? 'تشغيل' : 'Start')}
          >
            <span className="material-symbols-rounded text-base">
              {isActive ? 'pause_circle' : 'play_circle'}
            </span>
          </button>
          <button
            onClick={resetTimer}
            aria-label={isAr ? 'إعادة ضبط المؤقت' : 'Reset Timer'}
            className="hover:text-[#00E5FF] text-white/60 transition-colors focus-visible:ring-1 focus-visible:ring-[#00E5FF]"
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
          aria-label={isAr ? 'تصدير الدرس بصيغة PDF' : 'Export Lesson PDF'}
          className="flex items-center gap-1.5 px-3 py-1 bg-[#080D1E] hover:bg-white/10 text-xs font-semibold text-white transition-all border-2 border-white/20 hover:border-[#00E5FF] shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)] hover:shadow-[2px_2px_0px_0px_#00E5FF] focus-visible:ring-2 focus-visible:ring-[#00E5FF]"
          title={isAr ? 'تصدير الدرس PDF' : 'Export Lesson PDF'}
        >
          <span className="material-symbols-rounded text-sm text-[#00E5FF]">picture_as_pdf</span>
          <span className="hidden sm:inline font-mono">{isAr ? 'تصدير PDF' : 'Export PDF'}</span>
        </button>

        <button
          onClick={toggleFullscreen}
          aria-label={isAr ? 'ملء الشاشة' : 'Fullscreen'}
          className="p-1 bg-[#080D1E] hover:bg-white/10 text-white/80 hover:text-white transition-all border-2 border-white/20 hover:border-[#00E5FF] shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)] focus-visible:ring-2 focus-visible:ring-[#00E5FF]"
          title={isAr ? 'ملء الشاشة' : 'Fullscreen'}
        >
          <span className="material-symbols-rounded text-base">fullscreen</span>
        </button>
      </div>
    </header>
  );
};

export default TopBar;
