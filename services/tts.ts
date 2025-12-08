import { generateSpeechWithGemini } from "./geminiService";

// Hybrid TTS service
export const speakText = async (text: string, language: 'ar' | 'en') => {
  if (!text || typeof window === 'undefined') return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  try {
    // 1. Try to generate high-quality voice with Gemini
    const success = await generateSpeechWithGemini(text, language);
    if (success) {
      return; // Exit if Gemini TTS worked
    }
  } catch (error) {
    console.warn("Gemini TTS failed, falling back to Browser TTS:", error);
  }

  // 2. Fallback to browser's built-in voice if Gemini fails
  const utterance = new SpeechSynthesisUtterance(text);
  
  const voices = window.speechSynthesis.getVoices();
  let voice = null;
  if (language === 'ar') {
    voice = voices.find(v => v.lang.includes('ar'));
  } else {
    voice = voices.find(v => v.lang.includes('en-US') || v.lang.includes('en-GB'));
  }

  if (voice) {
    utterance.voice = voice;
  }
  
  utterance.lang = language === 'ar' ? 'ar-SA' : 'en-US';
  utterance.rate = 0.9;
  utterance.pitch = 1.0;

  window.speechSynthesis.speak(utterance);
};

// Ensure voices are loaded
if (typeof window !== 'undefined') {
    window.speechSynthesis.onvoiceschanged = () => {
        console.log("Browser voices loaded.");
    };
}
