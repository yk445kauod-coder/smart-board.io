import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, LessonDetail } from '../types';
import { sendMessageToGemini } from '../services/geminiService';

interface ChatProps {
  onToolCall: (name: string, args: any) => Promise<any>;
  projectorMode?: boolean;
  lessonDetail: LessonDetail;
  language: string;
}

const Chat: React.FC<ChatProps> = ({ 
  onToolCall, 
  projectorMode, 
  lessonDetail,
  language,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'أهلاً بك! أنا مساعدك البصري. عن ماذا تريد أن نتعلم اليوم؟', timestamp: Date.now() }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = { role: 'user', text: input, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const responseText = await sendMessageToGemini(userMsg.text, language, lessonDetail, onToolCall);
      if(responseText){
        const aiMsg: ChatMessage = { role: 'model', text: responseText, timestamp: Date.now() };
        setMessages(prev => [...prev, aiMsg]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'model', text: "حدث خطأ. حاول مرة أخرى.", timestamp: Date.now() }]);
    } finally {
      setLoading(false);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }};

  if (!isOpen) {
      return (
          <button onClick={() => setIsOpen(true)} className={`absolute bottom-6 right-6 z-[100] bg-indigo-600 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-all ${projectorMode ? 'scale-125' : 'scale-100'}`}>
              <i className="fa-solid fa-message text-2xl"></i>
          </button>
      );
  }

  return (
    <div className={`absolute bottom-6 right-6 z-[100] w-80 h-[500px] flex flex-col bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden font-ar transition-transform duration-300 ${projectorMode ? 'scale-110 origin-bottom-right' : 'scale-100'}`} dir="rtl">
      <div className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex justify-between items-center">
        <h2 className="font-bold text-lg flex items-center gap-2"><i className="fa-solid fa-robot"></i> Smart AI Tutor</h2>
        <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-2 rounded-lg"><i className="fa-solid fa-minus"></i></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[85%] rounded-2xl p-3 shadow-sm text-base ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-900 rounded-br-none' : 'bg-white text-gray-800 border rounded-bl-none'}`}>{msg.text}</div>
          </div>
        ))}
        {loading && <div className="text-center text-xs text-gray-400">AI is thinking...</div>}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 bg-white border-t border-gray-200">
        <div className="relative flex items-end gap-2">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="اكتب طلبك..." className="flex-1 p-3 rounded-xl border-2 bg-gray-50 max-h-32 text-sm" rows={1}/>
          <button onClick={handleSend} disabled={loading || !input.trim()} className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all mb-0.5"><i className="fa-solid fa-paper-plane"></i></button>
        </div>
      </div>
    </div>
  );
};

export default Chat;