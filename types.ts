export type Language = string;
export type LayoutMode = 'freestyle' | 'diagram' | 'timeline';
export type TeachingMode = 'classroom' | 'online' | 'self-study';
export type ToolType =
  | 'pointer'
  | 'pan'
  | 'pen'
  | 'highlighter'
  | 'eraser'
  // Manual Creation Tools
  | 'add-note'
  | 'add-text'
  | 'add-image'
  | 'add-shape'
  | 'add-ruler'
  // Advanced creation tools
  | 'add-arrow'
  | 'add-line'
  | 'add-equation'
  | 'add-table'
  | 'add-diagram'
  | 'add-mindmap'
  | 'add-flowchart'
  | 'add-timeline'
  | 'add-sticky';

export type LessonDetail = 'brief' | 'detailed';
export type ToolbarPosition = 'top' | 'left';
export type LessonMode =
  | 'full-lesson'
  | 'full-board'
  | 'revision'
  | 'activities'
  | 'explain'
  | 'simplify'
  | 'expand'
  | 'summarize'
  | 'visualize'
  | 'arrange'
  | 'questions'
  | 'translate'
  | 'solve'
  | 'pdf-to-board';

export interface TeacherPersona {
  name: string;
  language: Language;
  subject: string;
  personality: string;
  voice: 'male' | 'female';
  mode?: TeachingMode;
  topic?: string;
}

export type KnowledgeKind = 'pdf' | 'text' | 'notes';

export interface KnowledgeDoc {
  id: string;
  name: string;
  kind: KnowledgeKind;
  text: string;
  pages?: number;
  addedAt: number;
}

export interface PDFPageAnnotation {
  id: string;
  kind: 'pen' | 'note';
  points?: { x: number; y: number }[];
  color?: string;
  text?: string;
  x?: number;
  y?: number;
}

export interface PDFAnnotation {
  id: string;
  page: number;
  items: PDFPageAnnotation[];
}

export type ElementType =
  | 'note'
  | 'list'
  | 'image'
  | 'wordArt'
  | 'shape'
  | 'sketch'
  | 'code'
  | 'comparison'
  | 'text'
  | 'ruler'
  | 'arrow'
  | 'line'
  | 'equation'
  | 'table'
  | 'diagram'
  | 'mindmap'
  | 'flowchart'
  | 'timeline'
  | 'sticky';

// React Flow Data Interface
export interface ElementData {
  id: string;
  type: ElementType;
  content?: string;
  items?: string[];
  title?: string;
  url?: string;
  description?: string;
  text?: string;
  shapeType?: 'rectangle' | 'circle' | 'triangle' | 'diamond' | 'hexagon';
  code?: string;
  language?: string;
  style?: 'normal' | 'bold' | 'highlight';
  color?: string;
  rotation?: number;
  width?: number;
  height?: number;

  // For sketches
  points?: {x: number, y: number}[];
  strokeColor?: string;
  strokeWidth?: number;
  isHighlighter?: boolean;
  svgPath?: string;
  isFilled?: boolean;

  // For comparison/table
  columns?: { title: string; items: string[] }[];
  rows?: { cells: string[] }[];

  // For equation
  latex?: string;
  displayLatex?: boolean;

  // For arrow/line
  arrowStyle?: string;

  // For diagram/mindmap/flowchart/timeline (structured graph)
  graphNodes?: { id: string; label: string; color?: string; level?: number }[];
  graphEdges?: { from: string; to: string; label?: string }[];
  direction?: 'LR' | 'TB';

  // For mind map
  centerLabel?: string;
}

export interface ChatMessage {
  role: 'user' | 'model' | 'assistant';
  text: string;
  timestamp: number;
}

// Structured board command schema (the single contract between AI and board renderer)
export type BoardAction =
  | { action: 'addWordArt'; text: string; x?: number; y?: number; color?: string }
  | { action: 'addList'; title: string; items: string[]; x?: number; y?: number; color?: string }
  | { action: 'addComparison'; title: string; columns: { title: string; items: string[] }[]; x?: number; y?: number }
  | { action: 'addNote'; content: string; x?: number; y?: number; color?: string }
  | { action: 'addText'; text: string; x?: number; y?: number; color?: string }
  | { action: 'addImage'; description: string; x?: number; y?: number }
  | { action: 'addShape'; shapeType?: string; color?: string; x?: number; y?: number; width?: number; height?: number }
  | { action: 'addEquation'; latex: string; x?: number; y?: number; color?: string }
  | { action: 'addTable'; title: string; rows:(string[])[ ]; x?: number; y?: number; color?: string }
  | { action: 'addArrow'; from: string; to: string; label?: string; x?: number; y?: number; color?: string; anchor?: string }
  | { action: 'addLine'; x1: number; y1: number; x2: number; y2: number; color?: string; anchor?: string }
  | { action: 'addMindMap'; title: string; nodes: { id: string; label: string; color?: string }[]; x?: number; y?: number; centerLabel?: string }
  | { action: 'addFlowchart'; title: string; nodes: { id: string; label: string; color?: string }[]; edges: { from: string; to: string; label?: string }[]; x?: number; y?: number }
  | { action: 'addTimeline'; title: string; events: { label: string; description?: string; date?: string }[]; x?: number; y?: number }
  | { action: 'addDiagram'; title: string; items: { label: string; type?: 'node' | 'leaf'; color?: string }[]; x?: number; y?: number }
  | { action: 'addSticky'; content: string; x?: number; y?: number; color?: string }
  | { action: 'addCode'; code: string; language?: string; x?: number; y?: number }
  | { action: 'connect'; from: string; to: string; label?: string }
  | { action: 'update'; id: string; text?: string; content?: string; title?: string; color?: string; items?: string[] }
  | { action: 'remove'; id: string };

export interface BoardCommand {
  action: string;
  [key: string]: unknown;
}

export interface LessonRequest {
  mode: LessonMode;
  prompt: string;
  language: string;
  subject: string;
  detail: LessonDetail;
  context?: BoardContext;
}

export interface BoardContext {
  selectedElements?: { id: string; type: string; text?: string; title?: string; items?: string[]; content?: string }[];
  pdfText?: string;
  pdfPages?: number[];
  previousActions?: string[];
  boardSummary?: string;
}

export interface AICacheEntry {
  key: string;
  response: string;
  model: string;
  createdAt: number;
}

export interface ProjectData {
  version: 1;
  savedAt: number;
  settings: TeacherPersona;
  nodes: unknown[];
  edges: unknown[];
  annotations?: unknown[];
  pdf?: { name: string; dataUrl: string; annotations: unknown[] };
  pdfAnnotations?: unknown[];
  chatMessages: ChatMessage[];
}