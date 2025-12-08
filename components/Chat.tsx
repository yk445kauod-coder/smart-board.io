import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { sendMessageToGemini } from '../services/geminiService';

interface ChatProps {
  onToolCall: (name: string, args: any) => Promise<any>;
  projectorMode?: boolean;
}

const Chat: React.FC<ChatProps> = ({ onToolCall, projectorMode }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'مرحباً! أنا مدرسك الذكي. كيف يمكنني مساعدتك اليوم؟', timestamp: Date.now() }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = { role: 'user', text: input, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
    }));

    try {
      const responseText = await sendMessageToGemini(history, userMsg.text, 'ar', onToolCall);
      const aiMsg: ChatMessage = { role: 'model', text: responseText, timestamp: Date.now() };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'model', text: "حدث خطأ. حاول مرة أخرى.", timestamp: Date.now() }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
      return (
          <button 
            onClick={() => setIsOpen(true)}
            className={`absolute bottom-6 right-6 z-[100] bg-indigo-600 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-all
            ${projectorMode ? 'scale-125' : 'scale-100'}`}
          >
              <i className="fa-solid fa-message text-2xl"></i>
          </button>
      );
  }

  return (
    <div 
      className={`absolute bottom-6 right-6 z-[100] w-96 h-[600px] flex flex-col bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden font-ar transition-transform duration-300
      ${projectorMode ? 'scale-110 origin-bottom-right' : 'scale-100'}`} 
      dir="rtl"
    >
      <div className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex justify-between items-center">
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-robot w-5 h-5"></i>
          <h2 className="font-bold text-lg">Smart AI Tutor</h2>
        </div>
        <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-2 rounded-lg">
            <i className="fa-solid fa-minus"></i>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg, idx) => (
          <div 
            key={idx} 
            className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}
          >
            <div 
              className={`max-w-[85%] rounded-2xl p-3 shadow-sm text-base leading-snug
                ${msg.role === 'user' 
                  ? 'bg-indigo-100 text-indigo-900 rounded-br-none' 
                  : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'}
              `}
            >
              {msg.text.split('\n').map((line, i) => (
                  <p key={i} className="min-h-[1rem] mb-1">{line}</p>
              ))}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-end">
             <div className="bg-white px-3 py-2 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-2">
                 <span className="text-xs text-gray-400">جاري التحليل...</span>
                 <div className="flex gap-1">
                     <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
                     <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-75"></div>
                 </div>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 bg-white border-t border-gray-200">
        <div className="relative flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="اكتب طلبك..."
            className="flex-1 p-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-0 resize-none bg-gray-50 max-h-32 text-sm"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all mb-0.5"
          >
            <i className="fa-solid fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
