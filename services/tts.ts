import { generateSpeechWithGemini } from "./geminiService";
import { Language } from "../types";

const ttsQueue: { text: string; language: Language }[] = [];
let isSpeaking = false;

// Helper to speak with browser and return a promise that resolves on end
function speakWithBrowser(text: string, language: Language): Promise<void> {
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    let voice = null;
    
    // Find a voice that matches the language code (e.g., 'en' matches 'en-US')
    voice = voices.find(v => v.lang.startsWith(language));

    if (voice) utterance.voice = voice;
    utterance.lang = language;
    utterance.rate = 0.9;
    utterance.pitch = 1.0;

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve(); // Always resolve to not block the queue
    window.speechSynthesis.speak(utterance);
  });
}


async function processTtsQueue() {
  if (isSpeaking || ttsQueue.length === 0) {
    return;
  }
  isSpeaking = true;
  const item = ttsQueue.shift();

  if (item) {
    let spoken = false;
    try {
      // generateSpeechWithGemini now returns a promise that resolves on completion
      spoken = await generateSpeechWithGemini(item.text, item.language);
    } catch (e) {
      // The promise from generateSpeechWithGemini rejects on failure
      spoken = false;
    }

    if (!spoken) {
      // Fallback to browser TTS, which also awaits completion
      await speakWithBrowser(item.text, item.language);
    }
  }

  isSpeaking = false;
  // Check for the next item in the queue
  processTtsQueue();
}

// Regex to remove a wide range of emojis and symbols
const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}\u{238C}\u{2B06}\u{2197}]/gu;

export const speakText = (text: string, language: Language, isMuted: boolean) => {
  if (typeof window === 'undefined') return;

  if (isMuted) {
    // If muted, clear the queue and stop any current speech
    ttsQueue.length = 0;
    window.speechSynthesis.cancel();
    return;
  }

  // Filter out emojis and trim whitespace before speaking
  const cleanText = text.replace(emojiRegex, '').trim();

  // Only add to queue if there's actual text to speak
  if (cleanText) {
    ttsQueue.push({ text: cleanText, language });
    processTtsQueue();
  }
};


// Initial voice loading
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    console.log("Browser voices loaded.");
  };
}