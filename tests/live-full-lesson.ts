// Live E2E test of the deployed AI Teacher backend (hero path: board commands)
import type { LessonRequest } from '../types';

const req: LessonRequest = {
  mode: 'full-lesson',
  prompt: 'جهّز درسًا عن دورة الماء',
  language: 'Arabic',
  subject: 'Biology',
  detail: 'brief',
  context: { selectedElements: [], pdfText: '', pdfPages: [], boardSummary: '' },
};
const system =
  'أنت SmartBoard AI معلم ذكي بالعربية. ردّ دائمًا بالعربية. أعد ONLY مصفوفة JSON من أوامر اللوحة. ' +
  'أوامر متاحة: addWordArt,addNote,addText,addList,addShape,addSticky,addImage,addMindMap,addEquation,addTimeline. ' +
  'أول أمر addWordArt عنوان الدرس.';
const user =
  'اعد درسا كاملا عن دورة الماء: التبخر، التكاثف، الهطول. استخدم addWordArt للعنوان، addNote لشرح كل مرحلة، addList لقائمة مراحل الدورة.';

const body = JSON.stringify({ req, system, user });
const res = await fetch('https://smartboard-eg.pages.dev/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body,
});
const text = await res.text();
console.log('STATUS', res.status);
console.log(text.substring(0, 1600));