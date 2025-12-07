
export type Language = 'ar' | 'en';
export type LayoutMode = 'freestyle' | 'diagram' | 'timeline';
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
  | 'add-shape';

export interface TeacherPersona {
  name: string;
  language: Language;
  personality: string;
  voice: 'male' | 'female';
}

export type ElementType = 
  | 'note' 
  | 'list' 
  | 'image' 
  | 'wordArt' 
  | 'shape' 
  | 'sketch' 
  | 'code';

// React Flow Data Interface
export interface ElementData {
  id: string; // duplicate id in data for easier access
  type: ElementType;
  content?: string;
  items?: string[];
  title?: string;
  url?: string;
  description?: string;
  text?: string;
  shapeType?: 'rectangle' | 'circle' | 'triangle';
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
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}