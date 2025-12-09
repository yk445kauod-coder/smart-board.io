import React, { useState, useCallback } from 'react';

interface VisualizeTextModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVisualize: (text: string) => void;
}

const VisualizeTextModal: React.FC<VisualizeTextModalProps> = ({ isOpen, onClose, onVisualize }) => {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'text/plain') {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          setText(content);
          setFileName(file.name);
        };
        reader.readAsText(file);
      } else {
        alert('Unsupported file type. Please upload a .txt file.');
        setFileName('');
        event.target.value = ''; // Reset the input
      }
    }
  }, []);

  const handleVisualizeClick = () => {
    if (text.trim()) {
      onVisualize(text);
    } else {
      alert('Please enter some text or upload a file to visualize.');
    }
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[101] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border-4 border-gray-100" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gray-50 p-6 flex justify-between items-center text-gray-800 border-b">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <i className="fa-solid fa-file-import text-indigo-500"></i> Visualize Text or Data
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:bg-gray-200 p-2 rounded-full transition"><i className="fa-solid fa-xmark"></i></button>
        </div>
        
        <div className="p-8 space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Paste Text Below
            </label>
            <textarea 
              value={text}
              onChange={e => setText(e.target.value)}
              className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none font-mono text-sm min-h-[200px]"
              placeholder="Paste your raw text, article, or data here..."
            />
          </div>
          
          <div className="relative flex items-center">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink mx-4 text-gray-400 font-semibold">OR</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Upload a .txt file
            </label>
            <label className="w-full flex items-center justify-center px-4 py-6 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition">
              <div className="text-center">
                <i className="fa-solid fa-cloud-arrow-up text-3xl text-gray-400 mb-2"></i>
                <p className="font-medium text-gray-600">{fileName || 'Click to select a file'}</p>
                <p className="text-xs text-gray-400 mt-1">Plain Text (.txt) only</p>
              </div>
              <input type="file" className="hidden" accept=".txt" onChange={handleFileChange} />
            </label>
          </div>
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button 
            onClick={handleVisualizeClick}
            className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 hover:shadow-xl transition-all flex items-center gap-2 disabled:opacity-50"
            disabled={!text.trim()}
          >
            <i className="fa-solid fa-wand-magic-sparkles"></i>
            Visualize on Board
          </button>
        </div>
      </div>
    </div>
  );
};

export default VisualizeTextModal;
