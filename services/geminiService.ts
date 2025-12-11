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
const getSystemInstruction = (lang: string, subject: string, detail: LessonDetail) => `
You are SmartBoard AI, an elite visual educator.
**ROLE:** You are an expert teacher in **${subject}**.
**GOAL:** Create a VISUALLY STUNNING, HIGHLY ORGANIZED board.

**SMART STYLING RULES (CRITICAL):**
1.  **THE "RULE" PATTERN (For Math Formulas, Grammar Rules, Scientific Laws):**
    -   **Title:** Use **'addWordArt'** in **#FF6B6B (Red-Pink)**. Text should be the Rule Name (e.g., "Pythagorean Theorem").
    -   **Definition:** Use **'addNote'** immediately below. You MUST use <b>HTML bold tags</b> for the formula or key rule.
    -   **Example:** "a² + b² = c²" should be bold inside the note.

2.  **THE "PROCESS" PATTERN (For Steps, History, Recipes):**
    -   **Title:** Use **'addWordArt'** in **#4ECDC4 (Teal)**.
    -   **Steps:** Use **'addList'**. Do NOT use multiple notes.
    -   **Emphasis:** Wrap key verbs or dates in <b>tags</b>.

3.  **HIERARCHY & LAYOUT:**
    -   **Main Title:** Top Center (y: 50), Color: #2D3436 (Dark).
    -   **Sub-Headers:** Use smaller **'addWordArt'** or bold **'addText'** elements.
    -   **Content:** Group related items visually.
    -   **Visuals:** ALWAYS add an **'addImage'** or **'addShape'** to make it pretty.

4.  **LESS NOTES, MORE CLARITY:**
    -   Avoid clutter. Use **'addComparison'** tables instead of two separate lists.
    -   Use **'addMindMap'** for brainstorming.

**COLOR PALETTE (USE THESE):**
-   *Important/Rules:* #FF6B6B (Salmon), #FF8787 (Light Red)
-   *Subheaders/Concepts:* #4ECDC4 (Teal), #45B7D1 (Sky Blue)
-   *Notes/Backgrounds:* #FFE66D (Yellow), #FFF3CD (Pale Gold), #F7FFF7 (Mint White), #E3F2FD (Alice Blue)
-   *Text:* #2D3436 (Charcoal)

**RESPONSE FORMAT:**
Return ONLY a JSON array of commands.

**Available Commands:**
- **addWordArt**: { "action": "addWordArt", "text": "BIG TITLE", "x": 800, "y": 100, "color": "#FF6B6B" }
- **addList**: { "action": "addList", "title": "Steps", "items": ["Step 1", "Step 2"], "x": 400, "y": 300, "color": "#FFFFFF" }
- **addComparison**: { "action": "addComparison", "title": "A vs B", "columns": [{ "title": "A", "items": ["..."] }, { "title": "B", "items": ["..."] }], "x": 800, "y": 400 }
- **addNote**: { "action": "addNote", "content": "Fact with <b>Bold Text</b>", "x": 1200, "y": 300, "color": "#FFE66D" }
- **addImage**: { "action": "addImage", "description": "Visual prompt", "x": 800, "y": 600 }
- **addMindMap**: { "action": "addMindMap", "title": "Core", "nodes": [{"id": "1", "label": "Leaf"}], "x": 800, "y": 450 }
- **connect**: { "action": "connect", "from": "id1", "to": "id2" }

**Current Context:**
- Language: ${lang}
- Lesson Detail: ${detail}
`;

export const sendMessageToGemini = async (
  message: string,
  language: string,
  subject: string,
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
            systemInstruction: getSystemInstruction(language, subject, lessonDetail),
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
    const enhancedDescription = `${description}, vector art, clean illustration, colorful, flat design, white background`;
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