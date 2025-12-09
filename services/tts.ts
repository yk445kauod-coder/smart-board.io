import { getSpeechAudioData } from "./geminiService";
import { Language } from "../types";

// Keep track of both types of audio sources
let currentAudioSource: AudioBufferSourceNode | null = null;
let currentFallbackAudio: HTMLAudioElement | null = null;
let audioContext: AudioContext | null = null;

const getAudioContext = () => {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

// Updated to handle both sources
const stopAllSpeech = () => {
    if (currentAudioSource) {
        try {
            currentAudioSource.stop();
        } catch (e) {
             // Can error if already stopped
        }
        currentAudioSource = null;
    }
    if (currentFallbackAudio) {
        currentFallbackAudio.pause();
        currentFallbackAudio.src = ''; // Detach source
        currentFallbackAudio.onended = null;
        currentFallbackAudio.onerror = null;
        currentFallbackAudio = null;
    }
};

// --- Primary TTS Player (for Gemini's Base64 PCM data) ---
async function playAudioData(base64Data: string) {
    stopAllSpeech();
    const ctx = getAudioContext();
    try {
        const rawBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const pcm16 = new Int16Array(rawBytes.buffer);
        const frameCount = pcm16.length;
        const audioBuffer = ctx.createBuffer(1, frameCount, 24000);
        const channelData = audioBuffer.getChannelData(0);

        for (let i = 0; i < frameCount; i++) {
            channelData[i] = pcm16[i] / 32768.0;
        }

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.start(0);
        currentAudioSource = source;
        return new Promise<void>(resolve => {
            source.onended = () => {
                if (currentAudioSource === source) {
                    currentAudioSource = null;
                }
                resolve();
            };
        });
    } catch (error) {
        console.error("Failed to play Gemini audio data:", error);
        throw error; // Re-throw to be caught by speakText
    }
}


// --- Fallback TTS Logic (Rebuilt to avoid CORS issues) ---
async function speakWithFallback(text: string, language: Language) {
    stopAllSpeech();
    console.log("Using fallback TTS service.");
    const langCode = language.toLowerCase().startsWith('ar') ? 'ar' : 'en-US';
    
    if (text.length > 200) {
        console.warn("Fallback TTS truncating text to 200 characters.");
        text = text.substring(0, 200);
    }
    const encodedText = encodeURIComponent(text);

    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=${langCode}&client=tw-ob`;
    
    return new Promise<void>((resolve, reject) => {
        const audio = new Audio(url);
        currentFallbackAudio = audio; // This is an HTMLAudioElement

        audio.play().catch(e => {
            console.error("Fallback audio play failed:", e);
            if (currentFallbackAudio === audio) currentFallbackAudio = null;
            reject(e);
        });
        
        audio.onended = () => {
            if (currentFallbackAudio === audio) currentFallbackAudio = null;
            resolve();
        };

        audio.onerror = (e) => {
            console.error("Failed to play audio from URL via <audio> element:", e);
            if (currentFallbackAudio === audio) currentFallbackAudio = null;
            reject(new Error("Fallback audio playback failed."));
        };
    });
}

const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}\u{238C}\u{2B06}\u{2197}]/gu;

export const speakText = async (text: string, language: Language, isMuted: boolean) => {
    if (typeof window === 'undefined') return;

    stopAllSpeech();
    if (isMuted) return;

    const cleanText = text.replace(emojiRegex, '').trim();
    if (!cleanText) return;
    
    try {
        const audioData = await getSpeechAudioData(cleanText, language);
        if (audioData) {
            await playAudioData(audioData);
        } else {
             console.warn("Gemini TTS returned no audio data. Attempting fallback.");
             await speakWithFallback(cleanText, language);
        }
    } catch (e) {
        console.error("Gemini TTS failed. Attempting fallback.", e);
        try {
            await speakWithFallback(cleanText, language);
        } catch (fallbackError) {
            console.error("Fallback TTS also failed.", fallbackError);
        }
    }
};