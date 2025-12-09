import { getSpeechAudioData } from "./geminiService";
import { Language } from "../types";

let currentAudioSource: AudioBufferSourceNode | null = null;
let audioContext: AudioContext | null = null;

const getAudioContext = () => {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

const stopAllSpeech = () => {
    // Stop Gemini audio
    if (currentAudioSource) {
        try {
            currentAudioSource.stop();
        } catch (e) {
             // Can error if already stopped
        }
        currentAudioSource = null;
    }
};

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
        console.error("Failed to play audio data:", error);
    }
}

const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}\u{238C}\u{2B06}\u{2197}]/gu;

export const speakText = async (text: string, language: Language, isMuted: boolean) => {
    if (typeof window === 'undefined') return;

    // Always stop previous speech when a new request comes in
    stopAllSpeech();

    if (isMuted) {
        return;
    }

    const cleanText = text.replace(emojiRegex, '').trim();
    if (!cleanText) {
        return;
    }
    
    try {
        const audioData = await getSpeechAudioData(cleanText, language);
        if (audioData) {
            await playAudioData(audioData);
        } else {
             console.warn("Gemini TTS returned no audio data.");
        }
    } catch (e) {
        console.error("Gemini TTS failed. No fallback is available.", e);
    }
};
