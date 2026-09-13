import type { BoardAction, ChatMessage, KnowledgeDoc, LessonDetail, LessonMode, LessonRequest, TeacherPersona } from '../../types';
import { aiLangOf } from '../../types';
import { textToBoardCommands } from './omnirouter/providers';
import { buildRoutingHint, layoutCommands } from './omnirouter/boardSchema';
import { isPlainResponseMode } from './omnirouter/validate';
import { buildKnowledgeContext } from '../knowledge';
import { neutralizeDocText, truncateForPrompt } from '../../lib/sanitize';

export interface AssistantCall {
  mode: LessonMode;
  prompt: string;
  settings: TeacherPersona;
  detail: LessonDetail;
  history?: ChatMessage[];
  knowledgeDocs?: KnowledgeDoc[];
  boardSummary?: string;
  selectedElements?: Array<{ id: string; type: string; text?: string; title?: string; items?: string[]; content?: string; hasMapStrokes?: number }>;
   pdfText?: string;
   pdfPages?: number[];
 }

export const buildAssistantSystem = (mode: LessonMode, language: string, subject: string, settings?: TeacherPersona): string => {
  const isAr = language.toLowerCase().startsWith('ar');
  const teacherName = settings?.name && settings.name !== 'Smart Tutor' ? settings.name :
    isAr ? 'المعلم' : 'the teacher';
  const persona = settings?.personality && settings.personality !== 'Encouraging'
    ? settings.personality
    : isAr ? 'بأسلوب مشجّع وواضح ومناسب للفصل الدراسي' : 'in an encouraging, clear, classroom-appropriate style';
  return [
    'You are SmartBoard AI, a professional AI teacher assistant working with ' + teacherName + ' in a real classroom.',
    'You control a 1600x900 teaching whiteboard directly. You are the teacher\'s assistant, not a chatbot.',
    'You understand the current board, prepare complete lessons, write directly onto the board, draw diagrams and educational visuals, explain concepts, answer the teacher\'s questions, and modify existing board content.',
    'When the teacher asks to fix, edit, or change something already on the board, use update/remove on those elements (match their ID from the supplied selection/context) instead of adding duplicates.',
    isAr ? 'ردّ دائمًا بالعربية؛ تفاعل مع اللوحة واكتب عليها بالعربية ما لم يطلب المعلم غير ذلك.' : 'Always respond in the classroom language (' + language + ') unless the lesson vocabulary itself is foreign.',
    'You are teaching: ' + subject + '.',
    'Adopt this personality: ' + persona + '.',
  ].join('\n');
};

const MODE_HINT: Record<string, string> = {
  'full-lesson': 'Prepare a complete, well-structured lesson on the board: title, key concepts, explanations, examples, at most one image, questions and activities.',
  'full-board': 'Build a complete visual board that teaches the topic end-to-end.',
  'revision': 'Create a concise revision board: the most important facts, formulas and common mistakes.',
  'activities': 'Create an activities-and-practice board: exercises, questions and a small challenge.',
  'explain': 'Explain the concept clearly. Do NOT generate board commands. Answer directly.',
  'simplify': 'Explain it simply. Do NOT generate board commands. Answer directly.',
  'expand': 'Expand on the topic. Do NOT generate board commands. Answer directly.',
  'summarize': 'Summarize the key points. Do NOT generate board commands. Answer directly.',
  'questions': 'Ask 3-5 good practice questions. Do NOT generate board commands. Answer directly.',
  'translate': 'Translate the material. Do NOT generate board commands. Answer directly.',
  'solve': 'Solve the problem step by step. Do NOT generate board commands. Answer directly.',
  'visualize': 'Visualize the content on the board with notes, lists, a mind map or diagram.',
  'arrange': 'Reorganize the selected board elements into a clear layout using board commands. Use update/remove (with the element IDs from the selection) when content should change or disappear.',
  'pdf-to-board': 'Place the selected PDF page onto the board as an image using addImage.',
};

const buildUserPrompt = (req: LessonRequest, docs: KnowledgeDoc[]): string => {
  const parts: string[] = [];
  parts.push(buildRoutingHint(req, []));
  parts.push('');
  parts.push('Teacher request: ' + req.prompt);
  if (docs.length > 0) {
    parts.push('');
    parts.push(buildKnowledgeContext(req.prompt, docs));
  }
  return parts.join('\n');
};

const pickReply = (commands: BoardAction[], isAr: boolean): string => {
  const firstNote = commands.find(c => (c as any).action === 'addNote' && (c as any).content);
  if (firstNote) return String((firstNote as any).content);
  const firstArt = commands.find(c => (c as any).action === 'addWordArt' && (c as any).text);
if (firstArt) return String((firstArt as any).text);
const firstMap = commands.find(c => (c as any).action === 'addMindMap' && (c as any).title);
if (firstMap) return String((firstMap as any).title);
return isAr ? 'تم تحديث اللوحة.' : 'The board has been updated.';
};

async function applyBoardCommands(
commands: BoardAction[],
onToolCall: (name: string, args: Record<string, unknown>, originalMessage: string) => Promise<void>,
originalMessage: string
): Promise<void> {
const tempIdMap: Record<string, string> = {};
const edges: BoardAction[] = [];
const nodes: BoardAction[] = [];
for (const cmd of commands) {
if ((cmd as any).action === 'connect') {
edges.push(cmd);
} else if ((cmd as any).action) {
nodes.push(cmd);
}
}
for (const node of nodes) {
const finalId = 'ai-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
const rawId = (node as any).id;
if (typeof rawId === 'string' && rawId) {
tempIdMap[rawId] = finalId;
}
await onToolCall((node as any).action, { ...(node as any), id: finalId }, originalMessage);
}
for (const cmd of edges) {
const src = tempIdMap[(cmd as any).from];
const dst = tempIdMap[(cmd as any).to];
if (src && dst) {
await onToolCall('connect', { ...cmd, from: src, to: dst }, originalMessage);
}
}
}

async function askApiChat(req: LessonRequest, system: string, user: string): Promise<{ text: string; provider?: string; model?: string } | null> {
  try {
    const apiBase = (globalThis as any).__SMARTBOARD_API_BASE__ || '';
    const res = await fetch(`${apiBase}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ req, system, user }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.warn('[api/chat]', res.status, (errData as any)?.error || '');
      return null;
    }
    const data = await res.json() as { text?: string; provider?: string; model?: string };
    if (!data?.text || !data.text.trim()) return null;
    return { text: data.text, provider: data.provider, model: data.model };
  } catch (e) {
    console.warn('[api/chat] fetch failed:', (e as Error).message);
    return null;
  }
}

export const generateLesson = async (
  call: AssistantCall,
  onToolCall: (name: string, args: Record<string, unknown>, originalMessage: string) => Promise<void>,
  onSpeak: (text: string) => void
): Promise<string> => {
  const { mode, prompt, settings, detail } = call;
  const aiLanguage = aiLangOf(settings);
  const isAr = aiLanguage.toLowerCase().startsWith('ar');
const req: LessonRequest = {
mode,
prompt,
language: aiLanguage,
subject: settings.subject,
detail,
context: {
selectedElements: call.selectedElements,
pdfText: call.pdfText,
pdfPages: call.pdfPages,
boardSummary: call.boardSummary,
},
};
const system = buildAssistantSystem(mode, aiLanguage, settings.subject, settings) + '\n' + (MODE_HINT[mode] || MODE_HINT['full-lesson']);
const user = buildUserPrompt(req, call.knowledgeDocs || []);
if (isPlainResponseMode(mode)) {
// Plain chat answer modes
let lastErr: string | null = null;
try {
const viaApi = await askApiChat(req, system, user);
if (viaApi) {
const clean = neutralizeDocText(viaApi.text);
onSpeak(truncateForPrompt(clean, 400));
return clean;
}
} catch (e) {
lastErr = (e as Error).message;
}
return isAr ? 'لم أتمكن من الوصول إلى نموذج اللغة حاليًا. حاول مرة أخرى.' : 'I could not reach the language model right now. Please try again.' + (lastErr ? ' (' + lastErr + ')' : '');
}
// Board command modes
let lastErr2: string | null = null;
try {
  const viaApi = await askApiChat(req, system, user);
  if (viaApi) {
    const commands = textToBoardCommands(viaApi.text);
    if (commands.length === 0) {
      lastErr2 = 'Assistant returned no board commands';
    } else {
      const withLayout = layoutCommands(commands);
      await applyBoardCommands(withLayout, onToolCall, prompt);
      const reply = pickReply(withLayout, isAr);
      onSpeak(reply);
      return reply;
    }
  }
} catch (e) {
  lastErr2 = (e as Error).message;
}
return (isAr
  ? 'تعذر إنشاء الدرس من مزود الذكاء الاصطناعي. لم يتم تعديل اللوحة. حاول مرة أخرى.'
  : 'The AI provider did not return executable board commands. The board was not changed. Please try again.')
  + (lastErr2 ? ` (${lastErr2})` : '');
};
