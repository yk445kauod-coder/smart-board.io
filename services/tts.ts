import { getSpeechAudioData } from "./geminiService";
import { Language } from "../types";

// Queue State
interface SpeechTask {
    text: string;
    language: Language;
}

let speechQueue: SpeechTask[] = [];
let isProcessing = false;

// Audio State
let audioContext: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;
let currentFallbackAudio: HTMLAudioElement | null = null;

const getAudioContext = () => {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

// Stop any active playback immediately
const stopCurrentAudio = () => {
    if (currentSource) {
        try { currentSource.stop(); } catch(e) {}
        currentSource = null;
    }
    if (currentFallbackAudio) {
        try { 
            currentFallbackAudio.pause(); 
            currentFallbackAudio.currentTime = 0;
        } catch(e) {}
        currentFallbackAudio = null;
    }
};

// Public function to clear queue and stop speaking (e.g. user interruption)
export const cancelSpeech = () => {
    speechQueue = [];
    stopCurrentAudio();
    isProcessing = false;
};

// Play decoded audio buffer (Gemini)
const playBuffer = (base64Data: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        try {
            const ctx = getAudioContext();
            const rawBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            const pcm16 = new Int16Array(rawBytes.buffer);
            const audioBuffer = ctx.createBuffer(1, pcm16.length, 24000);
            const channelData = audioBuffer.getChannelData(0);
            for (let i = 0; i < pcm16.length; i++) {
                channelData[i] = pcm16[i] / 32768.0;
            }

            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            source.onended = () => {
                currentSource = null;
                resolve();
            };
            currentSource = source;
            source.start(0);
        } catch (e) {
            reject(e);
        }
    });
};

// Play fallback audio
const playFallback = (text: string, language: Language): Promise<void> => {
    return new Promise((resolve, reject) => {
        const langCode = language.toLowerCase().startsWith('ar') ? 'ar' : 'en-US';
        // Fallback truncation logic to avoid URL length issues
        const safeText = text.length > 200 ? text.substring(0, 200) : text;
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(safeText)}&tl=${langCode}&client=tw-ob`;
        
        const audio = new Audio(url);
        currentFallbackAudio = audio;
        
        audio.onended = () => {
            currentFallbackAudio = null;
            resolve();
        };
        audio.onerror = (e) => {
            currentFallbackAudio = null;
            reject(e);
        };
        
        audio.play().catch(e => {
            // Ignore interruption errors if we caused them via cancelSpeech
            console.warn("Fallback play interrupted/failed:", e);
            reject(e);
        });
    });
};

const processQueue = async () => {
    if (isProcessing || speechQueue.length === 0) return;
    isProcessing = true;

    const task = speechQueue[0]; // Peek at the first task

    try {
        // 1. Attempt Gemini TTS
        let audioData = null;
        try {
            // Fetching here sequentially helps avoid Rate Limit (429) errors
            audioData = await getSpeechAudioData(task.text, task.language);
        } catch (e) {
            console.warn("Gemini TTS fetch failed, trying fallback...");
        }

        // Check if queue was cleared while fetching (user interruption)
        if (speechQueue.length === 0 || speechQueue[0] !== task) {
             isProcessing = false;
             processQueue(); // recurs
             return;
        }

        if (audioData) {
            await playBuffer(audioData).catch(e => console.error("Buffer play failed", e));
        } else {
            await playFallback(task.text, task.language).catch(e => console.error("Fallback play failed", e));
        }

    } catch (err) {
        console.error("Critical TTS processing error:", err);
    } finally {
        // Remove processed task
        if (speechQueue.length > 0 && speechQueue[0] === task) {
            speechQueue.shift();
        }
        
        // REDUCED DELAY: Wait 300ms (was 600ms) before processing next item for snappier response
        await new Promise(r => setTimeout(r, 300));

        isProcessing = false;
        processQueue();
    }
};

const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}\u{238C}\u{2B06}\u{2197}]/gu;

export const speakText = (text: string, language: Language, isMuted: boolean) => {
    if (isMuted || typeof window === 'undefined') return;
    const cleanText = text.replace(emojiRegex, '').trim();
    if (!cleanText) return;

    speechQueue.push({ text: cleanText, language });
    processQueue();
};