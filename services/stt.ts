import { Language } from '../types';

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

const getRecognition = (): SpeechRecognitionLike | null => {
  if (typeof window === 'undefined') return null;
  const ctor =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    (window as any).SpeechRecognitionAlternative;
  if (!ctor) return null;
  return new ctor();
};

const toBCP47 = (language: Language): string => {
  const lang = (language || '' ).toLowerCase();
  if (lang.startsWith('ar')) return 'ar-SA';
  if (lang.startsWith('fr')) return 'fr-FR';
  if (lang.startsWith('it')) return 'it-IT';
  if (lang.startsWith('en')) return 'en-US';
  return 'en-US';
};

export interface STTController {
  supported: boolean;
  listening: boolean;
  start: (onFinal: (transcript: string) => void, onInterim?: (t: string) => void) => void;
  stop: () => void;
}

export const createSTT = (language: Language, isMuted: boolean): STTController => {
  let rec: SpeechRecognitionLike | null = null;
  let listening = false;

  const supported = typeof window !== 'undefined' &&
    !!( (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition );

  return {
    supported,
    get listening() { return listening; },
    start(onFinal, onInterim) {
      if (isMuted || listening) return;
      try {
        rec = getRecognition();
        if (!rec) return;

        rec.lang = toBCP47(language);
        rec.interimResults = true;
        rec.maxAlternatives = 1;
        rec.continuous = false;

        let finalText = '';

        rec.onresult = (event) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i];
            const t = res?.[0]?.transcript || '';
            if (res.isFinal) {
              finalText += t;
            } else {
              interim += t;
            }
          }
          if (interim) onInterim?.(interim);
        };

        rec.onerror = (event) => {
          console.warn('[stt]', event?.error || 'error');
          if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed') {
            listening = false;
            onFinal('');
          }
        };

        rec.onend = () => {
          listening = false;
          if (finalText.trim()) {
            onFinal(finalText.trim());
          } else {
            onFinal('');
          }
        };

        listening = true;
        rec.start();
      } catch (e) {
        console.warn('[stt] start failed', e);
        listening = false;
      }
    },
    stop() {
      if (rec && listening) {
        try { rec.stop(); } catch { /* noop */ }
      }
      listening = false;
    },
  };
};