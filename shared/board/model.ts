import { z } from 'zod';

export const BOARD_VERSION = 1 as const;
export const BOARD_WIDTH = 1600;
export const BOARD_HEIGHT = 900;

export const ElementId = z.string().min(1).max(64);

/** Hex colors only. Keeps every renderer (Konva, SVG, canvas) safe. */
export const BoardColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'expected #rrggbb');

const Point = z.object({ x: z.number().finite(), y: z.number().finite() });

const base = {
  id: ElementId,
  z: z.number().int().min(0).max(1_000_000).optional(),
};

const box = {
  x: z.number().finite(),
  y: z.number().finite(),
  w: z.number().finite().min(0).max(10_000),
  h: z.number().finite().min(0).max(10_000),
};

export const StrokeElement = z.object({
  ...base,
  kind: z.literal('stroke'),
  tool: z.enum(['pen', 'highlighter']),
  points: z.array(Point).min(2).max(4000),
  color: BoardColor,
  width: z.number().min(1).max(64),
});

export const TextElement = z.object({
  ...base,
  kind: z.literal('text'),
  ...box,
  text: z.string().max(5000),
  color: BoardColor,
  fontSize: z.number().min(10).max(200),
  align: z.enum(['start', 'middle', 'end']).default('start'),
  bold: z.boolean().default(false),
});

export const ShapeElement = z.object({
  ...base,
  kind: z.literal('shape'),
  shape: z.enum(['rect', 'ellipse', 'triangle']),
  ...box,
  color: BoardColor,
  fill: z.union([BoardColor, z.literal('transparent')]).default('transparent'),
  strokeWidth: z.number().min(1).max(32).default(3),
});

export const LineElement = z.object({
  ...base,
  kind: z.literal('line'),
  x1: z.number().finite(),
  y1: z.number().finite(),
  x2: z.number().finite(),
  y2: z.number().finite(),
  color: BoardColor,
  strokeWidth: z.number().min(1).max(32).default(3),
  arrow: z.boolean().default(false),
});

export const StickyElement = z.object({
  ...base,
  kind: z.literal('sticky'),
  ...box,
  w: z.number().min(80).max(800),
  h: z.number().min(60).max(800),
  text: z.string().max(2000),
  color: BoardColor,
  textColor: BoardColor,
  fontSize: z.number().min(12).max(64).default(22),
});

export const ImageElement = z.object({
  ...base,
  kind: z.literal('image'),
  ...box,
  src: z.string().min(1).max(4_000_000),
  alt: z.string().max(300).default(''),
});

export const BoardElement = z.discriminatedUnion('kind', [
  StrokeElement,
  TextElement,
  ShapeElement,
  LineElement,
  StickyElement,
  ImageElement,
]);

export type BoardElement = z.infer<typeof BoardElement>;
export type ElementKind = BoardElement['kind'];

export const BoardDoc = z.object({
  version: z.literal(BOARD_VERSION),
  title: z.string().max(200),
  background: BoardColor,
  elements: z.array(BoardElement).max(2000),
});

export type BoardDoc = z.infer<typeof BoardDoc>;

const MoveDelta = z.number().finite().min(-20_000).max(20_000);

export const BoardCommand = z.discriminatedUnion('type', [
  z.object({ type: z.literal('element.add'), element: BoardElement }),
  z.object({ type: z.literal('element.replace'), element: BoardElement }),
  z.object({
    type: z.literal('element.move'),
    ids: z.array(ElementId).min(1).max(200),
    dx: MoveDelta,
    dy: MoveDelta,
  }),
  z.object({ type: z.literal('element.delete'), ids: z.array(ElementId).min(1).max(200) }),
  z.object({
    type: z.literal('element.duplicate'),
    id: ElementId,
    newId: ElementId,
    dx: MoveDelta.default(24),
    dy: MoveDelta.default(24),
  }),
  z.object({
    type: z.literal('element.reorder'),
    id: ElementId,
    direction: z.enum(['front', 'back', 'forward', 'backward']),
  }),
  z.object({ type: z.literal('board.clear') }),
  z.object({ type: z.literal('board.background'), color: BoardColor }),
  z.object({ type: z.literal('board.title'), title: z.string().max(200) }),
]);

export type BoardCommand = z.infer<typeof BoardCommand>;

export const DEFAULT_DOC: BoardDoc = {
  version: BOARD_VERSION,
  title: 'سبورة جديدة',
  background: '#ffffff',
  elements: [],
};

export const STICKY_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fecdd3', '#e9d5ff'] as const;

export function emptyDoc(title = DEFAULT_DOC.title): BoardDoc {
  return { ...DEFAULT_DOC, title, elements: [] };
}

export function parseDoc(input: unknown): BoardDoc {
  return BoardDoc.parse(input);
}

export function safeParseDoc(input: unknown) {
  return BoardDoc.safeParse(input);
}

export function parseCommand(input: unknown): BoardCommand {
  return BoardCommand.parse(input);
}
