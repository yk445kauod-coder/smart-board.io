import React from 'react';
import { TeacherPersona } from '../types';

interface SettingsModalProps {
  settings: TeacherPersona;
  onSave: (s: TeacherPersona) => void;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onSave, onClose }) => {
  const [localSettings, setLocalSettings] = React.useState(settings);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border-4 border-gray-100">
        <div className="bg-indigo-600 p-6 flex justify-between items-center text-white">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <i className="fa-solid fa-user-gear"></i> إعدادات المدرس (Teacher Settings)
          </h2>
          <button onClick={onClose} className="hover:bg-indigo-700 p-2 rounded-full transition"><i className="fa-solid fa-xmark"></i></button>
        </div>
        
        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <i className="fa-solid fa-user-astronaut"></i> Persona Name
            </label>
            <input 
              type="text" 
              value={localSettings.name}
              onChange={e => setLocalSettings({...localSettings, name: e.target.value})}
              className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none font-medium"
              placeholder="e.g. Smart Tutor"
            />
          </div>

          <div className="space-y-2">
             <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <i className="fa-solid fa-language"></i> Language / اللغة
            </label>
            <div className="flex gap-4">
              <button 
                onClick={() => setLocalSettings({...localSettings, language: 'ar'})}
                className={`flex-1 p-3 rounded-xl border-2 font-bold transition-all ${localSettings.language === 'ar' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500'}`}
              >
                العربية
              </button>
              <button 
                onClick={() => setLocalSettings({...localSettings, language: 'en'})}
                className={`flex-1 p-3 rounded-xl border-2 font-bold transition-all ${localSettings.language === 'en' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500'}`}
              >
                English
              </button>
            </div>
          </div>

          <div className="space-y-2">
             <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <i className="fa-solid fa-microphone-lines"></i> Voice Preference
            </label>
            <div className="flex gap-4">
              <button 
                onClick={() => setLocalSettings({...localSettings, voice: 'female'})}
                className={`flex-1 p-3 rounded-xl border-2 font-medium transition-all ${localSettings.voice === 'female' ? 'border-pink-500 bg-pink-50 text-pink-700' : 'border-gray-200 text-gray-500'}`}
              >
                Female
              </button>
              <button 
                onClick={() => setLocalSettings({...localSettings, voice: 'male'})}
                className={`flex-1 p-3 rounded-xl border-2 font-medium transition-all ${localSettings.voice === 'male' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500'}`}
              >
                Male
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button 
            onClick={() => { onSave(localSettings); onClose(); }}
            className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 hover:shadow-xl transition-all"
          >
            Save Changes / حفظ
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
