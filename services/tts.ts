
import { generateSpeechWithGemini } from './geminiService';

// Hybrid TTS service: Tries Gemini first, falls back to Web Speech API
export const speakText = async (text: string, language: 'ar' | 'en') => {
  if (!text || typeof window === 'undefined') return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  try {
    // Attempt Gemini TTS (High Quality)
    await generateSpeechWithGemini(text, language);
  } catch (error) {
    console.log("Falling back to Browser TTS");
    // Fallback to Web Speech API
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Get voices
    const voices = window.speechSynthesis.getVoices();
    
    // Try to find a matching voice
    let voice = null;
    if (language === 'ar') {
      voice = voices.find(v => v.lang.includes('ar') || v.name.includes('Arabic'));
    } else {
      voice = voices.find(v => v.lang.includes('en-GB') || v.name.includes('Google US English'));
    }

    if (voice) {
      utterance.voice = voice;
    }
    
    utterance.lang = language === 'ar' ? 'ar-SA' : 'en-US';
    utterance.rate = 0.9; 
    utterance.pitch = 1.0;

    window.speechSynthesis.speak(utterance);
  }
};

// Ensure voices are loaded (some browsers load async)
if (typeof window !== 'undefined') {
    window.speechSynthesis.onvoiceschanged = () => {
        console.log("Voices loaded");
    };
}
