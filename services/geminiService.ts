import { GoogleGenAI, Modality } from "@google/genai";
import { LessonDetail } from '../types';

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
You are SmartBoard AI, an expert visual educator and creative guide.
Your purpose is to transform user prompts into rich, engaging visual explanations on a 1600x900 digital whiteboard.

**YOUR BEHAVIOR:**
1.  **Think Visually**: Don't just answer with text. Your primary goal is to create a compelling visual story using a wide variety of tools.
2.  **Be Creative**: Combine tools to create diagrams, flowcharts, and timelines. Use mind maps ('addMindMap') to explore a central topic with related ideas. Use comparison tables ('addComparison') to clearly contrast different concepts.
3.  **Lesson Style**: The user has requested a **'${detail}'** lesson. A 'brief' lesson should be simple and to the point. A 'detailed' lesson should be comprehensive, using multiple visual elements.
4.  **Start with a Bang**: Always begin your response with a strong visual element like a 'addWordArt' title or a central 'addNote'.
5.  **Use the Right Tool**: Use 'addWordArt' for short, impactful titles. Use 'addText' for longer paragraphs or descriptions.

**CRITICAL OUTPUT FORMAT:**
Your entire response MUST be a single, valid JSON array of command objects. Do NOT include any text, markdown, or explanations outside of the JSON array.

**Connecting Elements (VERY IMPORTANT):**
To create diagrams and flowcharts, you MUST connect elements. To do this:
1.  Add a unique string \`"id"\` to any element you want to connect (e.g., \`"id": "step1"\`).
2.  Use the \`"connect"\` action, referencing the \`"id"\`s in the \`"from"\` and \`"to"\` fields.

**Available Commands (JSON Objects):**
- **addNote**: { "action": "addNote", "id?": "temp_id", "content": "Text", "x": number, "y": number, "color?": "hex", "style?": "bold" }
- **addText**: { "action": "addText", "id?": "temp_id", "text": "A paragraph of text", "x": number, "y": number }
- **addList**: { "action": "addList", "id?": "temp_id", "title": "Title", "items": ["Item 1"], "x": number, "y": number }
- **addImage**: { "action": "addImage", "id?": "temp_id", "description": "A simple but effective prompt for an image generation AI (e.g. 'A red apple on a book'). Be descriptive but concise.", "x": number, "y": number }
- **addWordArt**: { "action": "addWordArt", "id?": "temp_id", "text": "Title Text", "x": number, "y": number }
- **addShape**: { "action": "addShape", "id?": "temp_id", "shapeType": "rectangle"|"circle"|"triangle", "x": number, "y": number }
- **addCode**: { "action": "addCode", "id?": "temp_id", "code": "code string", "language": "javascript", "x": number, "y": number }
- **addMindMap**: { "action": "addMindMap", "id?": "temp_id", "title": "Central Topic", "nodes": [{ "id": "string", "label": "Node Label" }], "x": number, "y": number }
- **addComparison**: { "action": "addComparison", "id?": "temp_id", "title": "Comparison", "columns": [{ "title": "Topic A", "items": ["Point 1"] }, { "title": "Topic B", "items": ["Point 1"] }], "x": number, "y": number }
- **connect**: { "action": "connect", "from": "source_temp_id", "to": "target_temp_id", "label?": "optional text" }

**Guidelines:**
- Canvas size is 1600x900. Center is (800, 450).
- Spread elements out visually. Avoid overlaps unless intentional.
- Use a variety of tools. A good explanation uses at least 2-3 different types of elements.
- Current Language: ${lang}.

**FINAL REMINDER: ONLY output the JSON array. Nothing else.**
`;

export const sendMessageToGemini = async (
  message: string,
  language: string,
  lessonDetail: LessonDetail,
  onToolCall: (name: string, args: any, originalMessage: string) => Promise<any>
) => {
  return addToQueue(async () => {
    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) return "Please configure your API Key in environment variables.";

      const ai = new GoogleGenAI({ apiKey });
      const chat = ai.chats.create({ 
        model: "gemini-2.5-flash",
        config: { 
            systemInstruction: getSystemInstruction(language, lessonDetail),
            responseMimeType: "application/json",
        },
      });

      const response = await chat.sendMessage({ message });
      const rawText = response.text || "";
      
      let processed = false;
      let replyText = "";
      let commands: any[] = [];

      try {
        const cleanedText = cleanJsonString(rawText);
        
        try {
            const parsed = JSON.parse(cleanedText);
            if (Array.isArray(parsed)) {
                commands = parsed;
            }
        } catch (e) {
            const jsonStart = cleanedText.indexOf('[');
            const jsonEnd = cleanedText.lastIndexOf(']');
            if (jsonStart !== -1 && jsonEnd !== -1) {
                const jsonStr = cleanedText.substring(jsonStart, jsonEnd + 1);
                const parsed = JSON.parse(jsonStr);
                if (Array.isArray(parsed)) {
                    commands = parsed;
                }
            }
        }

        if (commands.length > 0) {
            processed = true;
            
            const tempIdMap: Record<string, string> = {};
            const edgeCommands: any[] = [];
            const nodeCommands: any[] = [];

            // Separate nodes and edges
            commands.forEach(cmd => {
                if (cmd.action === 'connect') {
                    edgeCommands.push(cmd);
                } else if (cmd.action) {
                    nodeCommands.push(cmd);
                }
            });

            // First pass: create all nodes and map their temporary IDs to final IDs
            for (const node of nodeCommands) {
                const finalId = `ai-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
                if (node.id) {
                    tempIdMap[node.id] = finalId;
                }
                const toolArgs = { ...node, id: finalId };
                await onToolCall(node.action, toolArgs, message);
            }

            // Second pass: create all edges using the mapped IDs
            for (const cmd of edgeCommands) {
                const sourceId = tempIdMap[cmd.from];
                const targetId = tempIdMap[cmd.to];
                if (sourceId && targetId) {
                    await onToolCall('connect', { ...cmd, from: sourceId, to: targetId }, message);
                } else {
                    console.warn(`Could not find nodes for connection:`, cmd);
                }
            }
            
            // Generate a sensible text reply
            const firstNote = commands.find(c => c.action === 'addNote' && c.content);
            const firstArt = commands.find(c => c.action === 'addWordArt' && c.text);
            const firstMap = commands.find(c => c.action === 'addMindMap' && c.title);
            
            if(firstNote) {
                replyText = firstNote.content;
            } else if (firstArt) {
                replyText = firstArt.text;
            } else if (firstMap) {
                replyText = firstMap.title;
            } else {
                replyText = language.startsWith('ar') ? "تم تحديث اللوحة." : "The board has been updated.";
            }
        }
      } catch (e) {
          console.warn("Failed to parse JSON commands from response:", rawText, e);
      }

      if (!processed) {
        replyText = rawText;
        if (!replyText.trim()) {
            replyText = language.startsWith('ar') ? "لم أفهم الطلب. هل يمكنك المحاولة مرة أخرى بصيغة مختلفة؟" : "I didn't understand that. Could you try rephrasing?";
        }
      }
      return replyText;

    } catch (error: any) {
      console.error("Gemini API Error:", error);
      if (error.message?.includes('429') || error.message?.toLowerCase().includes('quota')) {
         return "I've run out of thinking power (Quota Exceeded). Please check your API Key settings.";
      }
      return `Sorry, an error occurred. (${error.message || 'Error'})`;
    }
  });
};

// --- Pollinations.ai Image Gen ---
export const generateImageWithPollinations = (description: string): string => {
    // Pollinations AI uses a URL structure for generation.
    // The description should be a simple, effective prompt.
    // Let's add some style hints to make it more artistic.
    const enhancedDescription = `${description}, cinematic, hyper-detailed, photorealistic, 8k`;
    const encodedDescription = encodeURIComponent(enhancedDescription);
    // Add a random seed to avoid caching and get different images for similar prompts.
    const seed = Math.floor(Math.random() * 100000);
    return `https://pollinations.ai/p/${encodedDescription}?width=512&height=512&seed=${seed}&nofeed=true`;
};


// --- Gemini TTS ---
// This function is now just a wrapper. The core logic is moved to tts.ts to handle state and interruptions.
export const getSpeechAudioData = (text: string, language: string): Promise<string | null> => {
  return new Promise(async (resolve, reject) => {
    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("API Key missing");
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: language.startsWith('ar') ? 'Zephyr' : 'Puck' } } }
        }
      });
      const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!audioData) throw new Error("No audio data returned from API");
      resolve(audioData);
    } catch (error) {
      console.error("TTS API Error:", error);
      reject(error);
    }
  });
};