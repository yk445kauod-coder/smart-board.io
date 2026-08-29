import type { BoardAction, LessonRequest } from '../../../types';
import { layoutCommands, BOARD_W } from './boardSchema';

// Deterministic offline lesson builder: guarantees the board is always buildable
// (zero network, zero API key). Uses a compact teaching template per subject domain.

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const n = (min: number, max: number): number => Math.floor(Math.random() * (max - min)) + min;

const TRUTHY = ['#FFF3CD', '#E3F2FD', '#F7FFF7', '#FFE66D', '#EFE9FB'];
const ACCENTS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FF8787', '#A78BFA'];

const title = (req: LessonRequest): string => {
  const lang = req.language.toLowerCase();
  if (lang.startsWith('ar')) return `درس: ${req.prompt}`;
  return `Lesson: ${req.prompt}`;
};

const introNote = (req: LessonRequest): string => {
  const lang = req.language.toLowerCase();
  if (lang.startsWith('ar')) return `اليوم سندرس <b>${req.prompt}</b> في مادة ${req.subject}. اتبع الخطوات التالية بالترتيب واستعد للأسئلة في النهاية.`;
  return `Today we study <b>${req.prompt}</b> in ${req.subject}. Follow the steps in order; then check yourself with the questions at the end.`;
};

const summaryNote = (req: LessonRequest): string => {
  const lang = req.language.toLowerCase();
  if (lang.startsWith('ar')) return `<b>الخلاصة:</b> راجع المفاهيم الرئيسية للدرس${req.prompt}وحل الأسئلة لتثبيت الفهم.;`;
  return `<b>Summary:</b> Review the key ideas of ${req.prompt} and test yourself with the questions to lock in your understanding.;`;
};

const activityList = (req: LessonRequest): { title: string; items: string[] } => {
  const lang = req.language.toLowerCase();
  const isAr = lang.startsWith('ar');
  return {
    title: isAr ? 'أنشطة وتدريبات' : 'Activities & Practice',
    items: [
      isAr ? 'اكتب خمس جمل مستخدمًا مفردات الدرس.' : 'Write five sentences using the lesson vocabulary.',
      isAr ? 'ارسم مخططًا يلخص النقاط الرئيسية.' : 'Draw a diagram that summarizes the main points.',
      isAr ? 'ناقش مع زميل: ما أصعب جزء في الدرس؟' : 'Discuss with a partner: what was the hardest part?',
    ],
  };
};

const questions = (req: LessonRequest): string[] => {
  const lang = req.language.toLowerCase();
  const isAr = lang.startsWith('ar');
  return [
    isAr ? '1) عرّف المصطلحات الرئيسية في الدرس بجملة واحدة لكل منها.' : '1) Define the main terms of the lesson in one sentence each.',
    isAr ? '2) اذكر ثلاث حقائق مهمة تعلمتها اليوم.' : '2) State three important facts you learned today.',
    isAr ? '3) كيف يمكن تطبيق ما تعلمته في الحياة اليومية؟' : '3) How can you apply what you learned in daily life?',
  ];
};

const buildSteps = (req: LessonRequest): { title: string, items: string[] } => {
  const lang = req.language.toLowerCase();
  const isAr = lang.startsWith('ar');
  const generic = [
    isAr ? 'اقرأ المقدمة وتعرّف على المفاهيم الأساسية.' : 'Read the introduction and get familiar with the core concepts.',
    isAr ? 'حلل الأمثلة المحلولة خطوة بخطوة.' : 'Work through the solved examples step by step.',
    isAr ? 'طبّق بنفسك ثم قارن إجابتك.' : 'Apply it yourself, then compare your answer.',
  ];
  const mathSteps = [
    isAr ? 'حدد المعطيات والمطلوب.' : 'Identify what is given and what is asked.',
    isAr ? 'اكتب القاعدة أو القانون المناسب.' : 'Write the relevant rule or formula.',
    isAr ? 'عوّض وحل خطوة بخطوة.' : 'Substitute and solve step by step.',
    isAr ? 'تحقق من منطقية الإجابة ووحداتها.' : 'Check the result for reasonableness and units.',
  ];
  const sciSteps = [
    isAr ? 'حدد الظاهرة أو السؤال العلمي.' : 'State the phenomenon or scientific question.',
    isAr ? 'اكتب الفرضية أو التوقع.' : 'Write a hypothesis or prediction.',
    isAr ? 'حلل الأسباب والنتائج.' : 'Analyze the causes and effects.',
    isAr ? 'لخص الاستنتاج النهائي.' : 'Summarize the final conclusion.',
  ];
  const litSteps = [
    isAr ? 'اقرأ النص قراءة أولى سريعة لفهم الفكرة العامة.' : 'Skim the text for the main idea.',
    isAr ? 'حدد الشخصيات والأحداث والصراع.' : 'Identify characters, events, and conflict.',
    isAr ? 'حلل الأسلوب واللغة.' : 'Analyze the style and language.',
    isAr ? 'اكتب خلاصة أو رأيًا مدعومًا.' : 'Write a supported summary or opinion.',
  ];
  const histSteps = [
    isAr ? 'حدد الفترة الزمنية والسياق التاريخي.' : 'Identify the time period and historical context.',
    isAr ? 'اذكر الأسباب الرئيسية.' : 'List the main causes.',
    isAr ? 'تابع الأحداث بالتسلسل الزمني.' : 'Follow the events in chronological order.',
    isAr ? 'استنتج النتائج والدروس المستفادة.' : 'Draw conclusions and lessons learned.',
  ];
  const subj = req.subject.toLowerCase();
  const mathRe = /(math|حساب|رياضيات)/;
  const sciRe = /(physics|chem|biology|علم|فيزياء|كيمياء|أحياء)/;
  const litRe = /(literature|أدب|لغة|قراءة)/;
  const histRe = /(history|تاريخ)/;
  if (mathRe.test(subj)) return { title:isAr ? 'خطوات الحل' : 'Solving Steps', items: mathSteps };
  if (sciRe.test(subj)) return { title:isAr ? 'المنهج العلمي' : 'Scientific Method', items: sciSteps };
  if (litRe.test(subj)) return { title:isAr ? 'خطوات التحليل الأدبي' : 'Literary Analysis Steps', items: litSteps };
  if (histRe.test(subj)) return { title:isAr ? 'التحليل التاريخي' : 'Historical Analysis', items: histSteps };
  return { title: isAr ? 'خطوات التعلم' : 'Learning Steps', items: generic };
};

const keyIdea = (req: LessonRequest): string => {
  const lang = req.language.toLowerCase();
  if (lang.startsWith('ar')) return `<b>فكرة أساسية:</b> ركّز على المفهوم المحوري في «${req.prompt}» واربط كل جزء به قبل الانتقال إلى التالي.;`;
  return `<b>Key idea:</b> Focus on the central concept of "${req.prompt}" and connect every part to it before moving on;;`;
};

// Builds a real, teachable board with no network dependency.
export const buildOfflineLesson = (req: LessonRequest): BoardAction[] => {
  const lang = req.language.toLowerCase();
  const isAr = lang.startsWith('ar');
  const steps = buildSteps(req);
  const acts = activityList(req);

  const commands: BoardAction[] = [];

  // Title
  commands.push({ action: 'addWordArt', text: title(req), color: '#2D3436' });

  // Intro note (teaching flow: context → define)
  commands.push({ action: 'addNote', content: introNote(req), color: pick(TRUTHY), x: undefined, y: undefined } as BoardAction);
  commands.push({ action: 'addNote', content: keyIdea(req), color: '#EFE9FB' } as BoardAction);

  // Steps list
  commands.push({ action: 'addList', title: steps.title, items: steps.items, color: '#4ECDC4' } as BoardAction);

  // Comparison: قبل/بعد or أنواع
  commands.push({
    action: 'addComparison',
    title: isAr ? 'قبل أن تبدأ / بعد أن تنتهي' : 'Before vs After',
    columns: [
      { title: isAr ? 'قبل الدرس' : 'Before the lesson', items: [isAr ? 'أفكار مبدئية أو أسئلة' : 'Prior ideas or questions', isAr ? 'توقعات' : 'Expectations'] },
      { title: isAr ? 'بعد الدرس' : 'After the lesson', items: [isAr ? 'مفاهيم واضحة' : 'Clear concepts', isAr ? 'قدرة على الشرح للآخرين' : 'Can explain to others'] },
    ],
  } as BoardAction);

  // Visual anchor: a simple labeled diagram (always editable SVG..)
  commands.push({
    action: 'addDiagram',
    title: isAr ? 'خريطة الدرس' : 'Lesson Map',
    items: [
      { label: req.prompt, type: 'node', color: '#FF6B6B' },
      { label: isAr ? 'فهم' : 'Understand', type: 'leaf' },
      { label: isAr ? 'تطبيق' : 'Apply', type: 'leaf' },
      { label: isAr ? 'تقييم' : 'Assess', type: 'leaf' },
    ],
  } as BoardAction);

  // Summary note
  commands.push({ action: 'addNote', content: summaryNote(req), color: '#E3F2FD' } as BoardAction);

  // Questions
  commands.push({ action: 'addList', title: isAr ? 'أسئلة للتفكير' : 'Discussion Questions', items: questions(req), color: '#FF8787' } as BoardAction);

  // Activities
  commands.push({ action: 'addList', title: acts.title, items: acts.items, color: '#45B7D1' } as BoardAction);

  commands.push({
    action: 'addShape',
    shapeType: 'diamond',
    color: '#A78BFA',
    width: 120,
    height: 120,
  } as BoardAction);

  return layoutCommands(commands);
};