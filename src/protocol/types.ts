export const BOARD_WIDTH = 1600;
export const BOARD_HEIGHT = 900;
export const BOARD_MARGIN = 40;

export type ProtocolColor = 'ink' | 'blue' | 'red' | 'green' | 'gray';

export const COLORS: Record<ProtocolColor, string> = {
  ink: '#1f2937',
  blue: '#2563eb',
  red: '#dc2626',
  green: '#16a34a',
  gray: '#6b7280',
};

export const FILLS: Record<ProtocolColor, string> = {
  ink: 'rgba(31,41,55,.08)',
  blue: 'rgba(37,99,235,.10)',
  red: 'rgba(220,38,38,.10)',
  green: 'rgba(22,163,74,.10)',
  gray: 'rgba(107,114,128,.10)',
};

export interface OpBase {
  id?: string;
  color?: ProtocolColor;
  width?: number;
}

export interface WriteOp extends OpBase {
  op: 'write';
  id: string;
  x: number;
  y: number;
  text: string;
  size?: number;
  anchor?: 'start' | 'middle';
  underline?: boolean;
}

export interface LineOp extends OpBase {
  op: 'line';
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  arrow?: boolean | 'both';
  dash?: boolean | string;
}

export interface RectOp extends OpBase {
  op: 'rect';
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: ProtocolColor;
}

export interface EllipseOp extends OpBase {
  op: 'ellipse';
  id: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rotate?: number;
  fill?: ProtocolColor;
}

export interface PathOp extends OpBase {
  op: 'path';
  id: string;
  d: string;
  fill?: ProtocolColor;
  arrow?: boolean | 'both';
  dash?: boolean | string;
}

export interface EraseOp {
  op: 'erase';
  ids?: string[];
  region?: { x: number; y: number; w: number; h: number };
  all?: boolean;
}

/* ── Extended ops (SmartBoard additions, not part of the frozen v1 protocol) ── */

export interface ImageOp {
  op: 'image';
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  src: string;
  alt?: string;
}

export interface TableOp {
  op: 'table';
  id: string;
  x: number;
  y: number;
  title?: string;
  columns: string[];
  rows: string[][];
  color?: ProtocolColor;
}

export interface GraphOp {
  op: 'graph';
  id: string;
  x: number;
  y: number;
  title?: string;
  kind: 'mindmap' | 'flowchart' | 'timeline' | 'diagram';
  nodes: { id: string; label: string; color?: ProtocolColor }[];
  edges?: { from: string; to: string; label?: string }[];
  color?: ProtocolColor;
}

export interface AtlasOp {
  op: 'atlas';
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  region: string;
  title?: string;
  pins?: string[];
}

export interface PeriodicOp {
  op: 'periodic';
  id: string;
  x: number;
  y: number;
  element: number;
  title?: string;
}

export interface WidgetOp {
  op: 'widget';
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: string;
  params?: Record<string, unknown>;
}

export interface UpdateOp {
  op: 'update';
  id: string;
  text?: string;
  x?: number;
  y?: number;
  color?: ProtocolColor;
}

export type ProtocolOp =
  | WriteOp
  | LineOp
  | RectOp
  | EllipseOp
  | PathOp
  | EraseOp
  | ImageOp
  | TableOp
  | GraphOp
  | AtlasOp
  | PeriodicOp
  | WidgetOp
  | UpdateOp;

export const V1_OPS = ['write', 'line', 'rect', 'ellipse', 'path', 'erase'] as const;
export const EXTENDED_OPS = ['image', 'table', 'graph', 'atlas', 'periodic', 'widget', 'update'] as const;
export type V1OpName = (typeof V1_OPS)[number];
export type ExtendedOpName = (typeof EXTENDED_OPS)[number];

export interface ProtocolStep {
  title?: string;
  say?: string;
  ops: ProtocolOp[];
}

export interface ProtocolScript {
  title?: string;
  lang?: string;
  steps: ProtocolStep[];
}

export interface BoardObjectState {
  id: string;
  type: string;
  bbox: { x: number; y: number; w: number; h: number };
  text?: string;
}

export interface BoardState {
  atStep: number;
  objects: BoardObjectState[];
}

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
