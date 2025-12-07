import { GoogleGenAI, Type, FunctionDeclaration, Modality } from "@google/genai";

// --- API CONFIGURATION ---
const API_KEY = process.env.API_KEY || "";

// --- Types ---
export interface ToolCall {
  name: string;
  args: any;
}

// --- Enhanced Request Queue System ---
interface QueueItem {
  task: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
}

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
      console.error("Queue task failed:", e);
      if (e.status === 429 || (e.message && e.message.includes('429'))) {
        console.warn("Rate limit hit in queue, pausing for 10 seconds...");
        await new Promise(r => setTimeout(r, 10000));
      }
      item.reject(e);
    } finally {
      setTimeout(() => {
        isProcessing = false;
        processQueue();
      }, 1000);
    }
  } else {
    isProcessing = false;
  }
};

const addToQueue = <T>(task: () => Promise<T>): Promise<T> => {
  return new Promise((resolve, reject) => {
    requestQueue.push({ task, resolve, reject });
    processQueue();
  });
};

// --- Tool Definitions ---
const functionDeclarations: FunctionDeclaration[] = [
  {
    name: "addNote",
    description: "Add a sticky note to the board.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        content: { type: Type.STRING },
        style: { type: Type.STRING, enum: ["normal", "bold", "highlight"] },
        color: { type: Type.STRING },
        x: { type: Type.NUMBER },
        y: { type: Type.NUMBER },
      },
      required: ["content"]
    }
  },
  {
    name: "addList",
    description: "Add a structured list to the board.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        items: { type: Type.ARRAY, items: { type: Type.STRING } },
        color: { type: Type.STRING },
        x: { type: Type.NUMBER },
        y: { type: Type.NUMBER },
      },
      required: ["items"]
    }
  },
  {
    name: "addImage",
    description: "Generate an image from a description.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        description: { type: Type.STRING },
        x: { type: Type.NUMBER },
        y: { type: Type.NUMBER },
      },
      required: ["description"]
    }
  },
  {
    name: "addWordArt",
    description: "Add a large decorative title.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING },
        color: { type: Type.STRING },
        x: { type: Type.NUMBER },
        y: { type: Type.NUMBER },
      },
      required: ["text"]
    }
  },
  {
    name: "addShape",
    description: "Add a geometric shape.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        shapeType: { type: Type.STRING, enum: ["rectangle", "circle", "triangle"] },
        color: { type: Type.STRING },
        x: { type: Type.NUMBER },
        y: { type: Type.NUMBER },
      },
      required: ["shapeType"]
    }
  },
  {
    name: "addCode",
    description: "Add a code snippet.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        code: { type: Type.STRING },
        language: { type: Type.STRING },
        x: { type: Type.NUMBER },
        y: { type: Type.NUMBER },
      },
      required: ["code", "language"]
    }
  },
  {
    name: "connectElements",
    description: "Connect two elements visually.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        fromId: { type: Type.STRING },
        toId: { type: Type.STRING },
      },
      required: ["fromId", "toId"]
    }
  }
];

// --- Gemini Text Gen ---
const getSystemInstruction = (lang: string) => `
You are an advanced AI Tutor powering a "SmartBoard AI".
Your role is to explain concepts visually on a digital whiteboard (Resolution: 1600x900).
Current Language: ${lang === 'ar' ? 'Arabic' : 'English'}.

Guidelines:
1. Explain the concept briefly in text.
2. IMMEDIATELY use tools to visualize it.
3. Organize elements logically.
4. Center is (800,450). Range: x[0-1600], y[0-900].
5. Spread elements so they don't overlap.
6. addImage: provide detailed visual description.
7. Use Google Search to verify info when needed.
`;

export const sendMessageToGemini = async (
  history: { role: 'user' | 'model'; parts: any[] }[],
  message: string,
  language: 'ar' | 'en',
  onToolCall: (name: string, args: any) => Promise<any>
) => {
  return addToQueue(async () => {
    if (!API_KEY) return language === 'ar' ? "يرجى ضبط مفتاح API." : "Please configure your API Key.";

    try {
      const ai = new GoogleGenAI({ apiKey: API_KEY });

      const chat = ai.chats.create({ 
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: getSystemInstruction(language),
          tools: [{ functionDeclarations }, { googleSearch: {} }],
        },
        history: history.map(h => ({
          role: h.role,
          parts: h.parts.map(p => ({ text: p.text }))
        }))
      });

      const response = await chat.sendMessage({ message });
      const fullText = response.text;
      const functionCalls = response.functionCalls;

      if (functionCalls && functionCalls.length > 0) {
        for (const call of functionCalls) {
          console.log("AI Tool Call:", call.name, call.args);
          await onToolCall(call.name, call.args);
        }
      }

      if (!fullText && functionCalls?.length) return language === 'ar' ? "تمت إضافة العناصر." : "Elements added.";
      return fullText || (language === 'ar' ? "تم تحديث اللوحة." : "Board updated.");

    } catch (error: any) {
      console.error("Gemini API Error:", error);
      if (error.status === 429 || (error.message && error.message.includes('429')))
        return language === 'ar'
          ? "عذراً، تم تجاوز الحد المسموح. انتظر قليلاً."
          : "Rate limit exceeded. Please wait.";
      return language === 'ar' 
        ? `حدث خطأ في الاتصال. (${error.message || 'Error'})`
        : `Connection error. (${error.message || 'Error'})`;
    }
  });
};

// --- Audio Helper ---
function pcmToWav(samples: Uint8Array, sampleRate: number = 24000, numChannels: number = 1) {
  const buffer = new ArrayBuffer(44 + samples.length);
  const view = new DataView(buffer);
  const writeString = (v: DataView, o: number, s: string) => { for (let i=0;i<s.length;i++) v.setUint8(o+i,s.charCodeAt(i)); };

  writeString(view,0,'RIFF'); view.setUint32(4,36+samples.length,true); writeString(view,8,'WAVE');
  writeString(view,12,'fmt '); view.setUint32(16,16,true); view.setUint16(20,1,true);
  view.setUint16(22,numChannels,true); view.setUint32(24,sampleRate,true);
  view.setUint32(28,sampleRate*numChannels*2,true); view.setUint16(32,numChannels*2,true);
  view.setUint16(34,16,true); writeString(view,36,'data'); view.setUint32(40,samples.length,true);
  new Uint8Array(buffer,44).set(samples);
  return buffer;
}

// --- Gemini TTS ---
export const generateSpeechWithGemini = async (text: string, language: 'ar' | 'en') => {
  if (!API_KEY) throw new Error("API Key missing");
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: language === 'ar' ? 'Zephyr' : 'Puck' } }
      }
    }
  });

  const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!audioData) throw new Error("No audio data");

  const binaryString = atob(audioData);
  const rawBytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) rawBytes[i] = binaryString.charCodeAt(i);

  const wavBuffer = pcmToWav(rawBytes, 24000, 1);
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioContext = new AudioContextClass();

  const audioBuffer = await audioContext.decodeAudioData(wavBuffer);
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);
  source.start(0);
  return true;
};
