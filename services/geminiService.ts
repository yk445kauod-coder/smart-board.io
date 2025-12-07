import { GoogleGenAI, Type, FunctionDeclaration, Modality } from "@google/genai";

// --- API CONFIGURATION ---
// Strictly use process.env.API_KEY injected by Vite. 
// Do not add fallback strings that look like keys to avoid secrets scanning errors.
const API_KEY = process.env.API_KEY || ""; 

// --- Types ---
export interface ToolCall {
  name: string;
  args: any;
}

// --- Request Queue System ---
let requestQueue: (() => Promise<any>)[] = [];
let isProcessing = false;

const processQueue = async () => {
  if (isProcessing || requestQueue.length === 0) return;
  isProcessing = true;

  const task = requestQueue.shift();
  if (task) {
    try {
      await task();
    } catch (e) {
      console.error("Queue task failed:", e);
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
    requestQueue.push(async () => {
      try {
        const result = await task();
        resolve(result);
      } catch (e) {
        reject(e);
      }
    });
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
        content: { type: Type.STRING, description: "The text content of the note" },
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
3. If asking for a layout, organize elements logically.
4. When using coordinates (x,y), assume the center is (800, 450). Range: x[0-1600], y[0-900].
5. Spread elements out so they don't overlap.
6. When using addImage, provide a highly detailed visual description for the prompt.
7. Use Google Search to verify information when needed.
`;

export const sendMessageToGemini = async (
  history: { role: 'user' | 'model'; parts: any[] }[],
  message: string,
  language: 'ar' | 'en',
  onToolCall: (name: string, args: any) => Promise<any>
) => {
  return addToQueue(async () => {
    try {
      if (!API_KEY) {
         return language === 'ar' ? "يرجى ضبط مفتاح API في إعدادات النشر." : "Please configure your API Key in deployment settings.";
      }

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

      if (!fullText && functionCalls && functionCalls.length > 0) {
          return language === 'ar' ? "تمت إضافة العناصر إلى اللوحة." : "Elements added to the board.";
      }

      return fullText || (language === 'ar' ? "تم تحديث اللوحة." : "Board updated.");

    } catch (error: any) {
      console.error("Gemini API Error:", error);
      return language === 'ar' 
        ? `عذراً، حدث خطأ في الاتصال. (${error.message || 'Error'})` 
        : `Sorry, connection error. (${error.message || 'Error'})`;
    }
  });
};

// --- Audio Helper: Wrap raw PCM in WAV header ---
function pcmToWav(samples: Uint8Array, sampleRate: number = 24000, numChannels: number = 1) {
    const buffer = new ArrayBuffer(44 + samples.length);
    const view = new DataView(buffer);
  
    // RIFF identifier
    writeString(view, 0, 'RIFF');
    // file length
    view.setUint32(4, 36 + samples.length, true);
    // RIFF type
    writeString(view, 8, 'WAVE');
    // format chunk identifier
    writeString(view, 12, 'fmt ');
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (raw)
    view.setUint16(20, 1, true);
    // channel count
    view.setUint16(22, numChannels, true);
    // sample rate
    view.setUint32(24, sampleRate, true);
    // byte rate (sample rate * block align)
    view.setUint32(28, sampleRate * numChannels * 2, true);
    // block align (channel count * bytes per sample)
    view.setUint16(32, numChannels * 2, true);
    // bits per sample
    view.setUint16(34, 16, true);
    // data chunk identifier
    writeString(view, 36, 'data');
    // data chunk length
    view.setUint32(40, samples.length, true);
  
    // write the PCM samples
    new Uint8Array(buffer, 44).set(samples);
  
    return buffer;
}
  
function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
}

// --- Gemini TTS ---
export const generateSpeechWithGemini = async (text: string, language: 'ar' | 'en') => {
  try {
    if (!API_KEY) {
        throw new Error("API Key missing");
    }

    const ai = new GoogleGenAI({ apiKey: API_KEY });
    
    // Using gemini-2.5-flash-preview-tts
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts", 
      contents: [
        {
          parts: [{ text: text }]
        }
      ],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: language === 'ar' ? 'Zephyr' : 'Puck'
            }
          }
        }
      }
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!audioData) {
        throw new Error("No audio data in response");
    }

    // Decode Base64 to Raw Bytes
    const binaryString = atob(audioData);
    const len = binaryString.length;
    const rawBytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        rawBytes[i] = binaryString.charCodeAt(i);
    }

    // Convert Raw PCM to WAV
    // Gemini 2.5 TTS typically returns 24kHz mono PCM
    const wavBuffer = pcmToWav(rawBytes, 24000, 1);

    // Play Audio
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioContextClass();
    
    try {
        const audioBuffer = await audioContext.decodeAudioData(wavBuffer);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start(0);
        return true;
    } catch (decodeError) {
        // Silently fail decoding to allow fallback
        console.warn("Audio decode failed, triggering fallback.");
        return false;
    }

  } catch (error) {
    // Silently fail API errors to allow fallback
    console.warn("Gemini TTS API failed, triggering fallback.");
    throw error;
  }
};