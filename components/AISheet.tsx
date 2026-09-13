import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, LessonMode, KnowledgeDoc } from '../types';
import { createSTT } from '../services/stt';
import { sanitizeHtml } from '../lib/sanitize';
import { MButton, Spinner, IconBtn } from './ui';

interface AISheetProps {
  messages: ChatMessage[];
  onSendMessage: (message: string, mode?: LessonMode) => void;
  isLoading: boolean;
  prefill?: string;
  onPrefillConsumed?: () => void;
  onModeSelect?: (mode: LessonMode) => void;
  mode?: LessonMode;
  language?: string;
  isMuted?: boolean;
  docs: KnowledgeDoc[];
  onOpenPdf?: () => void;
}

const QUICK_MODES: Array<{ mode: LessonMode; icon: string }> = [
  { mode: 'full-lesson', icon: 'menu_book' },
  { mode: 'explain', icon: 'lightbulb' },
  { mode: 'revision', icon: 'summarize' },
  { mode: 'questions', icon: 'quiz' },
  { mode: 'activities', icon: 'fitness_center' },
  { mode: 'visualize', icon: 'account_tree' },
];

const AISheet: React.FC<AISheetProps> = ({
  messages,
  onSendMessage,
  isLoading,
  prefill = '',
  onPrefillConsumed,
  onModeSelect,
  mode = 'full-lesson',
  language = 'en',
  isMuted = false,
  docs,
  onOpenPdf,
}) => {
  const isAr = language.toLowerCase().startsWith('ar');
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sttRef = useRef<ReturnType<typeof createSTT> | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (prefill) {
      setInput(prefill);
      onPrefillConsumed?.();
    }
  }, [prefill, onPrefillConsumed]);

  useEffect(() => () => sttRef.current?.stop(), []);

  const handleSend = (m?: LessonMode) => {
    if (!input.trim() || isLoading) return;
    if (m && onModeSelect) onModeSelect(m);
    onSendMessage(input, m);
    setInput('');
  };

  const toggleMic = () => {
    if (isListening) {
      sttRef.current?.stop();
      setIsListening(false);
      return;
    }
    const stt = createSTT(language, isMuted);
    sttRef.current = stt;
    if (!stt.supported) return;
    setIsListening(true);
    stt.start((text) => {
      setIsListening(false);
      if (text) onSendMessage(text);
    }, (interim) => {
      if (interim) setInput(interim);
    });
  };

  const formatMessage = (text: string) => {
    const html = text
      .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
      .replace(/\*(.*?)\*/g, '<i>$1</i>')
      .replace(/\n/g, '<br />');
    return sanitizeHtml(html);
  };

  const subLabel = (m: LessonMode): string => {
    const map: Record<LessonMode, { ar: string; en: string }> = {
      'full-lesson': { ar: 'حضّر درسًا كاملًا عن:', en: 'Prepare a complete lesson on:' },
      'full-board': { ar: 'ابنِ لوحة كاملة حول:', en: 'Build a full board about:' },
      revision: { ar: 'راجع ولخّص:', en: 'Revise and summarize:' },
      activities: { ar: 'أنشئ أنشطة وتمارين حول:', en: 'Create activities on:' },
      explain: { ar: 'اشرح:', en: 'Explain:' },
      simplify: { ar: 'بسّط:', en: 'Simplify:' },
      expand: { ar: 'وسّع شرح:', en: 'Expand on:' },
      summarize: { ar: 'لخّص:', en: 'Summarize:' },
      questions: { ar: 'وجّه أسئلة حول:', en: 'Ask questions about:' },
      translate: { ar: 'ترجم:', en: 'Translate:' },
      solve: { ar: 'حل:', en: 'Solve:' },
      visualize: { ar: 'صوّر على السبورة:', en: 'Visualize on the board:' },
      arrange: { ar: 'أعد ترتيب المحدد:', en: 'Rearrange the selection:' },
      'pdf-to-board': { ar: 'انقل صفحة PDF إلى السبورة:', en: 'Place this PDF page on the board:' },
    };
    return isAr ? map[m].ar : map[m].en;
  };

  return (
    <div className="bg-white rounded-t-3xl shadow-elev-12 flex flex-col max-h-[72vh]" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="px-6 pt-5 pb-3 border-b border-black/5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-tonal text-[#4a3f9e] flex items-center justify-center">
          <span className="material-symbols-rounded">smart_toy</span>
        </div>
        <div className="flex-1">
          <h2 className={`font-semibold text-on-surface leading-tight ${isAr ? 'font-display-ar' : 'font-display'}`}>
            {isAr ? 'المعلم الذكي' : 'AI Teacher'}
          </h2>
          <p className="text-xs text-on-surface/50">
            {isAr ? 'يساعدك على التحضير والشرح وتجهيز السبورة' : 'Prepares, explains and builds your board'}
          </p>
        </div>
        {docs.length > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-tonal text-[#4a3f9e] text-xs font-medium">
            <span className="material-symbols-rounded text-sm">database</span>
            {isAr ? `${docs.length} مصدر` : `${docs.length} source`}
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scroll-thin px-5 py-4 space-y-4 bg-surface-variant/30">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-elev-1 ${
                msg.role === 'user'
                  ? 'bg-primary text-white rounded-br-md'
                  : 'bg-white text-on-surface rounded-bl-md border border-black/5'
              }`}
              dir="auto"
            >
              {msg.role === 'user' ? msg.text : <span dangerouslySetInnerHTML={{ __html: formatMessage(msg.text) }} />}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-black/5 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2 text-sm text-on-surface/60">
              <Spinner size={16} className="text-primary" />
              {isAr ? 'أجهّز اللوحة...' : 'Preparing the board...'}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick modes */}
      <div className="px-4 pt-2.5 pb-1 flex items-center gap-2 overflow-x-auto scroll-thin">
        {QUICK_MODES.map((qm) => (
          <button
            key={qm.mode}
            onClick={() => { setInput(subLabel(qm.mode)); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              mode === qm.mode ? 'bg-primary text-white' : 'bg-surface-variant/60 text-on-surface/70 hover:bg-surface-variant'
            }`}
          >
            <span className="material-symbols-rounded text-sm">{qm.icon}</span>
            {qm.mode}
          </button>
        ))}
      </div>

      {/* Compose */}
      <div className="px-4 py-3 border-t border-black/5">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={isAr ? 'اكتب طلبك للمعلم الذكي...' : 'Ask the AI Teacher...'}
            rows={1}
            className="flex-1 px-4 py-3 rounded-2xl border border-black/10 bg-surface-variant/40 focus:bg-white focus:border-primary focus:outline-none text-sm resize-none max-h-32 scroll-thin"
          />
          <IconBtn label="Mic" icon={isListening ? 'mic' : 'mic_none'} onClick={toggleMic} active={isListening} className={isListening ? '!text-red-500' : ''} />
          <button
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            aria-label="Send"
            className="mat-btn w-11 h-11 rounded-full bg-primary text-white shadow-elev-1 flex items-center justify-center disabled:opacity-40"
          >
            <span className="material-symbols-rounded">arrow_upward</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AISheet;