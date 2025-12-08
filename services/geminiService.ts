import { GoogleGenAI, Modality } from "@google/genai";

// --- API CONFIGURATION ---
// Strictly use process.env.API_KEY injected by Vite. 
const API_KEY = process.env.API_KEY || ""; 

// --- Request Queue System ---
// This ensures requests are processed one by one (FIFO) to prevent race conditions and 429s
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
      // If rate limited (429), pause before processing next item
      if (e.status === 429 || (e.message && e.message.includes('429'))) {
          console.warn("Rate limit hit in queue, pausing for 5 seconds...");
          await new Promise(r => setTimeout(r, 5000));
      }
      item.reject(e);
    } finally {
      // Buffer delay between requests
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

// --- JSON Command Parsing Logic ---

// Helper to sanitize JSON string (remove markdown code blocks)
const cleanJsonString = (str: string) => {
    return str.replace(/```json/g, '').replace(/```/g, '').trim();
};

// --- Gemini Text Gen (JSON Mode) ---
const getSystemInstruction = (lang: string) => `
You are SmartBoard AI, an advanced visual tutor.
Your goal is to explain concepts by creating visual elements on a 1600x900 whiteboard.

**CRITICAL INSTRUCTION:**
You must output your response strictly as a JSON array of commands. 
Do not write conversational text outside the JSON. 
If you need to speak to the user, add an "addNote" or "addWordArt" command with the text.

**Available Commands (JSON Objects):**

1. **addNote**: Creates a sticky note.
   - params: { "action": "addNote", "content": "Text", "x": number, "y": number, "color": "hex", "style": "normal"|"bold" }
   
2. **addList**: Creates a list.
   - params: { "action": "addList", "title": "Title", "items": ["Item 1", "Item 2"], "x": number, "y": number, "color": "hex" }

3. **addImage**: Generates an image.
   - params: { "action": "addImage", "description": "Visual description", "x": number, "y": number }

4. **addWordArt**: Creates large text.
   - params: { "action": "addWordArt", "text": "Title", "x": number, "y": number, "color": "hex" }

5. **addShape**: Creates a shape.
   - params: { "action": "addShape", "shapeType": "rectangle"|"circle"|"triangle", "x": number, "y": number, "color": "hex" }

6. **addCode**: Creates a code block.
   - params: { "action": "addCode", "code": "code string", "language": "javascript"|"python"|etc, "x": number, "y": number }

7. **connectElements**: (Optional) Connects items implies flow.
   - params: { "action": "connectElements", "fromId": "id1", "toId": "id2" } (Note: IDs are managed by the frontend, usually strictly for sequential flow if supported).

**Guidelines:**
- Canvas size: 1600x900. Center is (800, 450).
- Spread elements out visually.
- Use bright, educational colors.
- Current Language: ${lang === 'ar' ? 'Arabic' : 'English'}.

**Example Output:**
[
  { "action": "addWordArt", "text": "Solar System", "x": 600, "y": 50, "color": "#ff9900" },
  { "action": "addImage", "description": "Realistic sun in space", "x": 600, "y": 200 },
  { "action": "addNote", "content": "The Sun is a star at the center...", "x": 600, "y": 500, "color": "#fff740" }
]
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
         return language === 'ar' ? "يرجى ضبط مفتاح API." : "Please configure API Key.";
      }

      const ai = new GoogleGenAI({ apiKey: API_KEY });
      // Use gemini-2.5-flash as requested (free tier friendly with this JSON approach)
      const chat = ai.chats.create({ 
        model: "gemini-2.5-flash",
        config: {
            systemInstruction: getSystemInstruction(language),
            // No tools config needed - we simulate it via JSON parsing
        },
        history: history.map(h => ({
            role: h.role,
            parts: h.parts.map(p => ({ text: p.text })) 
        }))
      });

      const response = await chat.sendMessage({ message });
      const rawText = response.text || "";
      
      let processed = false;
      let replyText = "";

      // Attempt to parse JSON commands
      try {
          const cleanedText = cleanJsonString(rawText);
          // Find first '[' and last ']' to extract JSON array if embedded in text
          const jsonStart = cleanedText.indexOf('[');
          const jsonEnd = cleanedText.lastIndexOf(']');
          
          if (jsonStart !== -1 && jsonEnd !== -1) {
              const jsonStr = cleanedText.substring(jsonStart, jsonEnd + 1);
              const commands = JSON.parse(jsonStr);
              
              if (Array.isArray(commands)) {
                  processed = true;
                  for (const cmd of commands) {
                      if (cmd.action) {
                          // Map JSON keys to expected tool args
                          console.log("Executing Command:", cmd.action, cmd);
                          await onToolCall(cmd.action, cmd);
                      }
                  }
                  replyText = language === 'ar' ? "تم إنشاء الدرس على السبورة." : "Lesson created on the board.";
              }
          }
      } catch (e) {
          console.warn("Failed to parse JSON commands:", e);
      }

      if (!processed) {
          // If no JSON found, return raw text (fallback conversation)
          replyText = rawText;
      }

      return replyText;

    } catch (error: any) {
      console.error("Gemini API Error:", error);
      return language === 'ar' 
        ? `عذراً، حدث خطأ. (${error.message || 'Error'})` 
        : `Sorry, error occurred. (${error.message || 'Error'})`;
    }
  });
};

// --- Audio Helper: Wrap raw PCM in WAV header ---
function pcmToWav(samples: Uint8Array, sampleRate: number = 24000, numChannels: number = 1) {
    const buffer = new ArrayBuffer(44 + samples.length);
    const view = new DataView(buffer);
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length, true);
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
    if (!API_KEY) throw new Error("API Key missing");

    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts", 
      contents: [{ parts: [{ text: text }] }],
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
    if (!audioData) throw new Error("No audio data");

    const binaryString = atob(audioData);
    const len = binaryString.length;
    const rawBytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        rawBytes[i] = binaryString.charCodeAt(i);
    }

    const wavBuffer = pcmToWav(rawBytes, 24000, 1);
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
        console.warn("Audio decode failed, triggering fallback.");
        return false;
    }
  } catch (error) {
    console.warn("Gemini TTS API failed, triggering fallback.");
    return false;
  }
};
