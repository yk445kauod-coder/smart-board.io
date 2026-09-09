import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, LessonMode } from '../types';
import { createSTT } from '../services/stt';
import { sanitizeHtml } from '../lib/sanitize';

interface ChatProps {
  messages: ChatMessage[];
  onSendMessage: (message: string, mode?: LessonMode) => void;
  isLoading: boolean;
  projectorMode?: boolean;
  prefill?: string;
  onPrefillConsumed?: () => void;
  onModeSelect?: (mode: LessonMode) => void;
  mode?: LessonMode;
  language?: string;
  isMuted?: boolean;
}

const Chat: React.FC<ChatProps> = ({
  messages,
  onSendMessage,
  isLoading,
  projectorMode,
  prefill = '',
  onPrefillConsumed,
  onModeSelect,
  mode = 'full-lesson',
  language = 'en',
  isMuted = false,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sttRef = useRef<ReturnType<typeof createSTT> | null>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (prefill) {
      setInput(prefill);
      onPrefillConsumed?.();
    }
  }, [prefill]);

  useEffect(() => {
    return () => sttRef.current?.stop();
  }, []);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput('');
  };

  const handleSendWithMode = (m: LessonMode) => {
    if (!input.trim() || isLoading) return;
    onModeSelect?.(m);
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
      if (text) {
        onSendMessage(text);
      }
    }, (interim) => {
      if (interim) setInput(interim);
    });
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => { 
    if (e.key === 'Enter' && !e.shiftKey) { 
      e.preventDefault(); 
      handleSend(); 
    }
  };

  const formatMessage = (text: string) => {
    // Basic Markdown to HTML conversion, then sanitize
    const html = text
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') // Bold **text**
        .replace(/\*(.*?)\*/g, '<i>$1</i>')     // Italic *text*
        .replace(/\n/g, '<br />');              // Newlines
    return sanitizeHtml(html);
  };

  const QUICK_MODES: Array<{ mode: LessonMode; icon: string; label: string }> = [
    { mode: 'full-lesson', icon: 'fa-chalkboard-user', label: 'Lesson' },
    { mode: 'revision', icon: 'fa-list-check', label: 'Revise' },
    { mode: 'explain', icon: 'fa-lightbulb', label: 'Explain' },
    { mode: 'questions', icon: 'fa-question', label: 'Questions' },
    { mode: 'activities', icon: 'fa-dumbbell', label: 'Activities' },
    { mode: 'visualize', icon: 'fa-diagram-project', label: 'Visualize' },
  ];

  if (!isOpen) {
      return (
          <button onClick={() => setIsOpen(true)} className={`absolute bottom-6 right-6 z-[100] bg-indigo-600 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-all ${projectorMode ? 'scale-125' : 'scale-100'}`}>
              <i className="fa-solid fa-message text-2xl"></i>
          </button>
      );
  }

  return (
    <div className={`absolute bottom-6 right-6 z-[100] w-80 h-[500px] flex flex-col bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden font-ar transition-transform duration-300 ${projectorMode ? 'scale-110 origin-bottom-right' : 'scale-100'}`} dir="rtl">
      <div className="p-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex justify-between items-center">
        <h2 className="font-bold text-lg flex items-center gap-2"><i className="fa-solid fa-robot"></i> Smart AI Tutor</h2>
        <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-2 rounded-lg" title="Minimize"><i className="fa-solid fa-minus"></i></button>
      </div>

      <div className="px-3 pt-2 pb-1 bg-white border-b border-gray-100 flex flex-wrap gap-1">
        {QUICK_MODES.map((qm) => (
          <button
            key={qm.mode}
            onClick={() => handleSendWithMode(qm.mode)}
            disabled={isLoading}
            className={`flex-1 min-w-0 px-2 py-1 rounded-lg text-xs whitespace-nowrap transition-colors ${mode === qm.mode ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-indigo-100'}`}
            title={qm.label}
          >
            <i className={`fa-solid ${qm.icon} mr-1`}></i>{qm.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div 
                className={`max-w-[85%] rounded-2xl p-3 shadow-sm text-base ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-900 rounded-br-none' : 'bg-white text-gray-800 border rounded-bl-none'}`}
                dir="auto"
            >
                {msg.role === 'model' ? (
                     <div dangerouslySetInnerHTML={{ __html: formatMessage(msg.text) }} />
                ) : (
                    msg.text
                )}
            </div>
          </div>
        ))}
        {isLoading && <div className="text-center text-xs text-gray-400">AI is thinking...</div>}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 bg-white border-t border-gray-200">
        <div className="relative flex items-end gap-2">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="اكتب طلبك للمساعد..." className="flex-1 p-3 rounded-xl border-2 bg-gray-50 max-h-32 text-sm" rows={1}/>
          <button onClick={toggleMic} disabled={isLoading} title={isListening ? 'Listening...' : 'Voice input'} className={`p-3 rounded-xl transition-all mb-0.5 ${isListening ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}><i className={`fa-solid ${isListening ? 'fa-microphone-lines' : 'fa-microphone'}`}></i></button>
          <button onClick={handleSend} disabled={isLoading || !input.trim()} className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all mb-0.5"><i className="fa-solid fa-paper-plane"></i></button>
        </div>
      </div>
    </div>
  );
};

export default Chat;