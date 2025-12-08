import { GoogleGenAI, Modality } from "@google/genai";
import { LessonDetail } from '../types';

// --- API CONFIGURATION ---
// IMPORTANT: Paste your Google Gemini API Key here.
const API_KEY = "YOUR_API_KEY_HERE"; 

// --- Request Queue System ---
interface QueueItem { task: () => Promise<any>; resolve: (value: any) => void; reject: (reason?: any) => void; }
const requestQueue: QueueItem[] = [];
let isProcessing = false;

const processQueue = async () => {
  if (isProcessing || requestQueue.length === 0) return;
  isProcessing = true;
  const item = requestQueue.shift();
  if (item) {
    try {
      const result = await item.task();
      item.resolve(result);
    } catch (e: any) {
      item.reject(e);
    } finally {
      setTimeout(() => { isProcessing = false; processQueue(); }, 10);
    }
  } else {
    isProcessing = false;
  }
};

const addToQueue = <T>(task: () => Promise<T>): Promise<T> => {
  return new Promise((resolve, reject) => {
    requestQueue.push({ task, resolve, reject });
    if (!isProcessing) processQueue();
  });
};

const cleanJsonString = (str: string) => str.replace(/```json/g, '').replace(/```/g, '').trim();

// --- Gemini Text Gen (JSON Mode) ---
const getSystemInstruction = (lang: string, detail: LessonDetail) => `
You are SmartBoard AI, a creative and friendly visual guide with an enthusiastic, encouraging, and playful personality.
Your goal is to make learning fun on a 1600x900 digital whiteboard.

**YOUR BEHAVIOR:**
1.  **Be Conversational**: Start with a friendly greeting using an \`addNote\` or \`addWordArt\` command.
2.  **Visualize Everything**: Use a variety of visual tools to bring your explanation to life.
3.  **Be Human**: Use natural language and emojis (like 🚀, ✨, 🤔).
4.  **Lesson Style**: The user has requested a **'${detail}'** lesson. Adjust your explanation accordingly (brief summary vs. in-depth explanation).

**CRITICAL OUTPUT FORMAT:**
You MUST respond ONLY with a valid JSON array of commands. Do not write any text outside the JSON structure.

**Available Commands (JSON Objects):**
- **addNote**: { "action": "addNote", "content": "Text", "x": number, "y": number }
- **addList**: { "action": "addList", "title": "Title", "items": ["Item 1"], "x": number, "y": number }
- **addImage**: { "action": "addImage", "description": "A detailed visual description", "x": number, "y": number }
- **addWordArt**: { "action": "addWordArt", "text": "Title Text", "x": number, "y": number }
- **addShape**: { "action": "addShape", "shapeType": "rectangle"|"circle", "x": number, "y": number }
- **addCode**: { "action": "addCode", "code": "code string", "language": "javascript", "x": number, "y": number }

**Guidelines:**
- Canvas size: 1600x900. Center is (800, 450).
- Spread elements out visually.
- Current Language: ${lang}.
`;

export const sendMessageToGemini = async (
  message: string,
  language: string,
  lessonDetail: LessonDetail,
  onToolCall: (name: string, args: any) => Promise<any>
) => {
  return addToQueue(async () => {
    try {
      if (!API_KEY || API_KEY === "YOUR_API_KEY_HERE") return "Please configure your API Key in services/geminiService.ts";

      const ai = new GoogleGenAI({ apiKey: API_KEY });
      const chat = ai.chats.create({ 
        model: "gemini-2.5-flash",
        config: { systemInstruction: getSystemInstruction(language, lessonDetail) },
      });

      const response = await chat.sendMessage({ message });
      const rawText = response.text || "";
      
      let processed = false;
      let replyText = "";

      try {
          const cleanedText = cleanJsonString(rawText);
          const jsonStart = cleanedText.indexOf('[');
          const jsonEnd = cleanedText.lastIndexOf(']');
          
          if (jsonStart !== -1 && jsonEnd !== -1) {
              const jsonStr = cleanedText.substring(jsonStart, jsonEnd + 1);
              const commands = JSON.parse(jsonStr);
              
              if (Array.isArray(commands)) {
                  processed = true;
                  for (const cmd of commands) {
                      if (cmd.action) await onToolCall(cmd.action, cmd);
                  }
                  
                  // Find conversational text to display in chat
                  const firstNote = commands.find(c => c.action === 'addNote' && c.content);
                  const firstArt = commands.find(c => c.action === 'addWordArt' && c.text);
                  
                  if(firstNote) {
                      replyText = firstNote.content;
                  } else if (firstArt) {
                      replyText = firstArt.text;
                  } else {
                      replyText = language.startsWith('ar') ? "تم تحديث اللوحة." : "The board has been updated.";
                  }
              }
          }
      } catch (e) {
          console.warn("Failed to parse JSON commands:", e);
      }

      if (!processed) replyText = rawText;
      return replyText;

    } catch (error: any) {
      console.error("Gemini API Error:", error);
      return `Sorry, an error occurred. (${error.message || 'Error'})`;
    }
  });
};

// --- Audio Helper ---
function pcmToWav(samples: Uint8Array, sampleRate = 24000) {
    const buffer = new ArrayBuffer(44 + samples.length);
    const view = new DataView(buffer);
    const write = (offset: number, str: string) => str.split('').forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
    write(0, 'RIFF'); view.setUint32(4, 36 + samples.length, true); write(8, 'WAVE');
    write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true);
    view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, samples.length, true);
    new Uint8Array(buffer, 44).set(samples);
    return buffer;
}

// --- Gemini TTS ---
export const generateSpeechWithGemini = (text: string, language: string): Promise<boolean> => {
  return new Promise(async (resolve, reject) => {
    try {
      if (!API_KEY || API_KEY === "YOUR_API_KEY_HERE") throw new Error("API Key missing");
      const ai = new GoogleGenAI({ apiKey: API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: language.startsWith('ar') ? 'Zephyr' : 'Puck' } } }
        }
      });
      const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!audioData) throw new Error("No audio data");

      const rawBytes = Uint8Array.from(atob(audioData), c => c.charCodeAt(0));
      const wavBuffer = pcmToWav(rawBytes);
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(wavBuffer);
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.onended = () => resolve(true);
      source.start(0);
    } catch (error) {
      reject(false);
    }
  });
};