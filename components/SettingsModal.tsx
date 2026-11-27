import React from 'react';
import { TeacherPersona } from '../types';
import { api } from '../src/api/client';
import { Sheet, MButton } from './ui';

const urlBase64ToUint8Array = (base64: string): Uint8Array => {
  const padded = base64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
};

type PushState = 'checking' | 'unsupported' | 'off' | 'on' | 'denied' | 'working' | 'error';

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
  const [pushState, setPushState] = React.useState<PushState>('checking');
  const [pushMessage, setPushMessage] = React.useState('');

  React.useEffect(() => {
    let alive = true;
    const check = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        if (alive) setPushState('unsupported');
        return;
      }
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (alive) setPushState(sub ? 'on' : Notification.permission === 'denied' ? 'denied' : 'off');
      } catch {
        if (alive) setPushState('off');
      }
    };
    void check();
    return () => { alive = false; };
  }, []);

  const enablePush = async () => {
    setPushMessage('');
    setPushState('working');
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error(t('المتصفح لا يدعم الإشعارات.', 'This browser does not support push.'));
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushState('denied');
        setPushMessage(t('لازم تسمح بالإشعارات من إعدادات المتصفح.', 'Allow notifications in the browser settings.'));
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const info = await api.push.publicKey();
      if (!info.configured || !info.publicKey) throw new Error(t('الإشعارات غير مهيأة على الخادم بعد.', 'Push is not configured on the server yet.'));
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(info.publicKey),
      });
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('Invalid push subscription');
      await api.push.subscribe({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        userAgent: navigator.userAgent,
      });
      setPushState('on');
      setPushMessage(t('تم تفعيل الإشعارات.', 'Notifications enabled.'));
    } catch (err) {
      setPushState('error');
      setPushMessage(err instanceof Error ? err.message : t('تعذر تفعيل الإشعارات.', 'Could not enable notifications.'));
    }
  };

  const disablePush = async () => {
    setPushMessage('');
    setPushState('working');
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await api.push.unsubscribe(sub.endpoint).catch(() => undefined);
        await sub.unsubscribe();
      }
      setPushState('off');
      setPushMessage(t('تم إيقاف الإشعارات.', 'Notifications disabled.'));
    } catch {
      setPushState('error');
      setPushMessage(t('تعذر إيقاف الإشعارات.', 'Could not disable notifications.'));
    }
  };

  const testPush = async () => {
    setPushMessage('');
    try {
      const result = await api.push.test();
      setPushMessage(result.sent > 0 ? t(`تم إرسال إشعار تجريبي (${result.sent}).`, `Test notification sent (${result.sent}).`) : t('لا توجد اشتراكات نشطة.', 'No active subscriptions.'));
    } catch (err) {
      setPushMessage(err instanceof Error ? err.message : t('تعذر إرسال الإشعار.', 'Could not send the notification.'));
    }
  };

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
            <span className="material-symbols-rounded text-base">notifications</span> {t('إشعارات الفصل', 'Class notifications')}
          </label>
          <div className="rounded-2xl border border-black/10 bg-surface-variant/30 p-3">
            <div className="text-sm font-medium text-on-surface/80">
              {pushState === 'on'
                ? t('الإشعارات مفعّلة على هذا الجهاز.', 'Notifications are on for this device.')
                : pushState === 'denied'
                  ? t('الإشعارات مرفوضة من المتصفح.', 'Notifications are blocked by the browser.')
                  : pushState === 'unsupported'
                    ? t('المتصفح لا يدعم Web Push.', 'This browser does not support Web Push.')
                    : t('فعّل الإشعارات لتصلك تحديثات الدروس والواجبات.', 'Enable notifications for lesson and assignment updates.')}
            </div>
            {pushMessage && <div className="mt-2 text-xs text-on-surface/60">{pushMessage}</div>}
            <div className="mt-3 flex flex-wrap gap-2">
              {pushState !== 'on' ? (
                <button onClick={enablePush} disabled={pushState === 'working' || pushState === 'unsupported'} className="mat-btn px-3 py-2 rounded-xl bg-primary text-white text-xs font-bold disabled:opacity-50">
                  {t('تفعيل الإشعارات', 'Enable notifications')}
                </button>
              ) : (
                <>
                  <button onClick={testPush} className="mat-btn px-3 py-2 rounded-xl bg-primary text-white text-xs font-bold">{t('إرسال تجربة', 'Send test')}</button>
                  <button onClick={disablePush} className="mat-btn px-3 py-2 rounded-xl border border-black/10 text-xs font-bold text-on-surface/70">{t('إيقاف', 'Disable')}</button>
                </>
              )}
            </div>
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
