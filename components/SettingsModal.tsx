import React from 'react';
import { TeacherPersona } from '../types';
import { Sheet, MButton } from './ui';

interface SettingsModalProps {
  settings: TeacherPersona;
  onSave: (s: TeacherPersona) => void;
  onClose: () => void;
}

const LANGUAGES = ['Arabic', 'English', 'French', 'Italian'];

const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onSave, onClose }) => {
  const [local, setLocal] = React.useState(settings);
  const isAr = local.language.toLowerCase().startsWith('ar');
  const t = (ar: string, en: string) => (isAr ? ar : en);

  const handleSave = () => {
    onSave(local);
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={<span className="inline-flex items-center gap-2"><span className="material-symbols-rounded text-primary">settings</span> {t('الإعدادات', 'Settings')}</span>} maxW="max-w-lg">
      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-on-surface/70 flex items-center gap-2">
            <span className="material-symbols-rounded text-base">smart_toy</span> {t('اسم المساعد', 'Assistant name')}
          </label>
          <input
            type="text"
            value={local.name}
            onChange={(e) => setLocal({ ...local, name: e.target.value })}
            className="w-full px-4 py-3 rounded-2xl border border-black/10 bg-surface-variant/40 focus:bg-white focus:border-primary focus:outline-none text-sm"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-on-surface/70 flex items-center gap-2">
            <span className="material-symbols-rounded text-base">language</span> {t('لغة الواجهة', 'Interface language')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {LANGUAGES.map((l) => (
              <button
                key={l}
                onClick={() => setLocal({ ...local, language: l })}
                className={`mat-btn px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${local.language === l ? 'bg-tonal border-primary text-[#4a3f9e]' : 'bg-surface-variant/40 border-black/10 text-on-surface/70'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-on-surface/70 flex items-center gap-2">
            <span className="material-symbols-rounded text-base">smart_toy</span> {t('لغة رد المعلم الذكي', 'AI Teacher response language')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {LANGUAGES.map((l) => (
              <button
                key={l}
                onClick={() => setLocal({ ...local, aiLanguage: l })}
                className={`mat-btn px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${(local.aiLanguage || local.language) === l ? 'bg-tonal border-primary text-[#4a3f9e]' : 'bg-surface-variant/40 border-black/10 text-on-surface/70'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-on-surface/70 flex items-center gap-2">
            <span className="material-symbols-rounded text-base">record_voice_over</span> {t('الصوت', 'Vocal style')}
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => setLocal({ ...local, voice: 'female' })}
              className={`mat-btn flex-1 px-4 py-3 rounded-2xl border-2 text-sm font-medium transition-all ${local.voice === 'female' ? 'bg-tonal border-primary text-[#4a3f9e]' : 'bg-surface-variant/40 border-black/10 text-on-surface/70'}`}
            >
              {t('أنثى', 'Female')}
            </button>
            <button
              onClick={() => setLocal({ ...local, voice: 'male' })}
              className={`mat-btn flex-1 px-4 py-3 rounded-2xl border-2 text-sm font-medium transition-all ${local.voice === 'male' ? 'bg-tonal border-primary text-[#4a3f9e]' : 'bg-surface-variant/40 border-black/10 text-on-surface/70'}`}
            >
              {t('ذكر', 'Male')}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-on-surface/70 flex items-center gap-2">
            <span className="material-symbols-rounded text-base">volume_up</span> {t('محرك النطق', 'Speech engine')}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['gemini', 'browser', 'off'] as const).map((mode) => (
              <button key={mode} onClick={() => setLocal({ ...local, ttsMode: mode })} className={`mat-btn px-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${(local.ttsMode || 'gemini') === mode ? 'bg-tonal border-primary text-[#4a3f9e]' : 'bg-surface-variant/40 border-black/10 text-on-surface/70'}`}>
                {mode === 'gemini' ? 'Gemini' : mode === 'browser' ? t('المتصفح', 'Browser') : t('إيقاف', 'Off')}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-on-surface/70 flex items-center gap-2">
            <span className="material-symbols-rounded text-base">personality</span> {t('شخصية المساعد', 'Personality')}
          </label>
          <input
            type="text"
            value={local.personality}
            onChange={(e) => setLocal({ ...local, personality: e.target.value })}
            className="w-full px-4 py-3 rounded-2xl border border-black/10 bg-surface-variant/40 focus:bg-white focus:border-primary focus:outline-none text-sm"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <MButton variant="text" onClick={onClose}>{t('إلغاء', 'Cancel')}</MButton>
        <MButton onClick={handleSave}>{t('حفظ', 'Save')}</MButton>
      </div>
    </Sheet>
  );
};

export default SettingsModal;
