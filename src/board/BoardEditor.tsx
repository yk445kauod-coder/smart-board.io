import { useCallback, useEffect, useRef, useState } from 'react';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Arrow, Ellipse, Group, Layer, Line, Rect, Stage, Text as KonvaText, Transformer } from 'react-konva';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  type BoardDoc,
  type BoardElement,
} from '../../shared/board/model';
import {
  canRedo,
  canUndo,
  commit,
  createHistory,
  redo,
  undo,
  type History,
} from '../../shared/board/reducer';
import { elementBounds, findFreeSpot, hitTest, normalizeBox } from '../../shared/board/geometry';
import { Icon, type IconName } from './icons';

export type SaveState = 'saved' | 'saving' | 'dirty' | 'offline' | 'error';

type Tool =
  | 'select' | 'pen' | 'highlighter' | 'eraser' | 'text' | 'sticky'
  | 'rect' | 'ellipse' | 'triangle' | 'line' | 'arrow' | 'pan';

interface Point {
  x: number;
  y: number;
}

type Draft =
  | { kind: 'stroke'; points: Point[] }
  | { kind: 'shape'; shape: 'rect' | 'ellipse' | 'triangle'; start: Point; current: Point }
  | { kind: 'line'; start: Point; current: Point; arrow: boolean };

interface EditorState {
  id?: string;
  kind: 'text' | 'sticky';
  x: number;
  y: number;
  w: number;
  h: number;
  value: string;
  fontSize: number;
}

const PALETTE = ['#0f172a', '#059669', '#2563eb', '#dc2626', '#f59e0b', '#7c3aed', '#0891b2', '#db2777'];
const STICKY_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff', '#fed7aa'];
const WIDTHS = [2, 4, 8, 14];

const TOOLS: Array<{ tool: Tool; icon: IconName; label: string }> = [
  { tool: 'select', icon: 'select', label: 'تحديد' },
  { tool: 'pen', icon: 'pen', label: 'قلم' },
  { tool: 'highlighter', icon: 'highlighter', label: 'هايلايتر' },
  { tool: 'eraser', icon: 'eraser', label: 'ممحاة' },
  { tool: 'text', icon: 'text', label: 'نص' },
  { tool: 'sticky', icon: 'sticky', label: 'ملاحظة' },
  { tool: 'rect', icon: 'rect', label: 'مستطيل' },
  { tool: 'ellipse', icon: 'ellipse', label: 'دائرة' },
  { tool: 'triangle', icon: 'triangle', label: 'مثلث' },
  { tool: 'line', icon: 'line', label: 'خط' },
  { tool: 'arrow', icon: 'arrow', label: 'سهم' },
  { tool: 'pan', icon: 'pan', label: 'تحريك' },
];

const SAVE_LABEL: Record<SaveState, string> = {
  saved: 'محفوظ',
  saving: 'جارٍ الحفظ…',
  dirty: 'تغييرات غير محفوظة',
  offline: 'محفوظ محلياً — بدون شبكة',
  error: 'تعذّر الحفظ',
};

function uid(): string {
  return `e-${crypto.randomUUID()}`;
}

function isArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export interface BoardEditorProps {
  initialDoc: BoardDoc;
  title: string;
  saveState: SaveState;
  onTitleChange?: (title: string) => void;
  onDocChange: (doc: BoardDoc) => void;
  onBack?: () => void;
  onSaveToLibrary?: (doc: BoardDoc) => void;
}

export function BoardEditor({
  initialDoc,
  title,
  saveState,
  onTitleChange,
  onDocChange,
  onBack,
  onSaveToLibrary,
}: BoardEditorProps) {
  const [history, setHistory] = useState<History>(() => createHistory(initialDoc));
  const doc = history.present;
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#0f172a');
  const [stickyColor, setStickyColor] = useState(STICKY_COLORS[0] ?? '#fef08a');
  const [width, setWidth] = useState(4);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const editorInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [scale, setScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 800, height: 600 });

  const stageRef = useRef<Konva.Stage>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef(new Map<string, Konva.Node>());
  const draftRef = useRef<Draft | null>(null);
  const eraseRef = useRef<Set<string>>(new Set());
  const firstRender = useRef(true);
  const editorRef = useRef<EditorState | null>(null);

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Focus after the opening pointerup, otherwise the browser's default focus
  // handling blurs the textarea immediately and commits an empty element.
  const editorOpen = editor !== null;
  useEffect(() => {
    if (!editorOpen) return;
    const id = setTimeout(() => editorInputRef.current?.focus(), 30);
    return () => clearTimeout(id);
  }, [editorOpen]);

  const run = useCallback((command: unknown) => {
    setHistory((current) => {
      try {
        return commit(current, command);
      } catch (error) {
        console.warn('board command rejected', error);
        return current;
      }
    });
  }, []);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    onDocChange(doc);
  }, [doc, onDocChange]);

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    const node = selectedId ? nodeRefs.current.get(selectedId) : null;
    transformer.nodes(node ? [node] : []);
    transformer.getLayer()?.batchDraw();
  }, [selectedId, doc]);

  const selected = selectedId ? doc.elements.find((e) => e.id === selectedId) ?? null : null;

  const toBoard = useCallback((stage: Konva.Stage): Point | null => {
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    return { x: (pointer.x - stage.x()) / stage.scaleX(), y: (pointer.y - stage.y()) / stage.scaleY() };
  }, []);

  const commitEditor = useCallback(() => {
    const current = editorRef.current;
    if (!current) return;
    setEditor(null);
    const text = current.value.trim();
    if (current.id) {
      const existing = doc.elements.find((e) => e.id === current.id);
      if (existing && (existing.kind === 'sticky' || existing.kind === 'text')) {
        run({ type: 'element.replace', element: { ...existing, text: current.value } });
      }
      return;
    }
    if (!text) return;
    if (current.kind === 'text') {
      run({
        type: 'element.add',
        element: {
          id: uid(),
          kind: 'text',
          x: current.x,
          y: current.y,
          w: current.w,
          h: current.h,
          text: current.value,
          color,
          fontSize: current.fontSize,
          align: 'start',
          bold: false,
        },
      });
    } else {
      const spot = findFreeSpot(doc, 220, 160, { x: current.x - 110, y: current.y - 80 });
      run({
        type: 'element.add',
        element: {
          id: uid(),
          kind: 'sticky',
          x: spot.x,
          y: spot.y,
          w: 220,
          h: 160,
          text: current.value,
          color: stickyColor,
          textColor: '#0f172a',
          fontSize: 22,
        },
      });
    }
  }, [color, doc, run, stickyColor]);

  const openEditorFor = useCallback((element: BoardElement) => {
    if (element.kind === 'sticky') {
      setEditor({ id: element.id, kind: 'sticky', x: element.x, y: element.y, w: element.w, h: element.h, value: element.text, fontSize: element.fontSize });
    } else if (element.kind === 'text') {
      setEditor({ id: element.id, kind: 'text', x: element.x, y: element.y, w: Math.max(element.w, 220), h: Math.max(element.h, 60), value: element.text, fontSize: element.fontSize });
    }
  }, []);

  const handlePointerDown = (event: KonvaEventObject<PointerEvent>) => {
    const stage = event.target.getStage();
    if (!stage) return;
    if (editorRef.current) commitEditor();
    const point = toBoard(stage);
    if (!point) return;

    if (tool === 'select') {
      if (event.target === stage) setSelectedId(null);
      return;
    }
    if (tool === 'pan') return;
    if (tool === 'text') {
      setEditor({ kind: 'text', x: point.x, y: point.y, w: 320, h: 70, value: '', fontSize: 26 });
      return;
    }
    if (tool === 'sticky') {
      setEditor({ kind: 'sticky', x: point.x, y: point.y, w: 220, h: 160, value: '', fontSize: 22 });
      return;
    }
    if (tool === 'eraser') {
      eraseRef.current = new Set();
      const hit = hitTest(doc, point);
      if (hit) eraseRef.current.add(hit.id);
      return;
    }
    if (tool === 'pen' || tool === 'highlighter') {
      const next: Draft = { kind: 'stroke', points: [point] };
      draftRef.current = next;
      setDraft(next);
      return;
    }
    if (tool === 'line' || tool === 'arrow') {
      const next: Draft = { kind: 'line', start: point, current: point, arrow: tool === 'arrow' };
      draftRef.current = next;
      setDraft(next);
      return;
    }
    const next: Draft = { kind: 'shape', shape: tool, start: point, current: point };
    draftRef.current = next;
    setDraft(next);
  };

  const handlePointerMove = (event: KonvaEventObject<PointerEvent>) => {
    const stage = event.target.getStage();
    if (!stage) return;
    const point = toBoard(stage);
    if (!point) return;
    if (tool === 'eraser') {
      const hit = hitTest(doc, point);
      if (hit) eraseRef.current.add(hit.id);
      return;
    }
    const current = draftRef.current;
    if (!current) return;
    if (current.kind === 'stroke') {
      const last = current.points[current.points.length - 1];
      if (last && Math.hypot(point.x - last.x, point.y - last.y) < 1.5) return;
      const next: Draft = { ...current, points: [...current.points, point] };
      draftRef.current = next;
      setDraft(next);
    } else {
      const next = { ...current, current: point } as Draft;
      draftRef.current = next;
      setDraft(next);
    }
  };

  const handlePointerUp = () => {
    if (tool === 'eraser') {
      const ids = Array.from(eraseRef.current);
      eraseRef.current = new Set();
      if (ids.length > 0) run({ type: 'element.delete', ids });
      return;
    }
    const current = draftRef.current;
    draftRef.current = null;
    setDraft(null);
    if (!current) return;
    if (current.kind === 'stroke') {
      if (current.points.length < 2) return;
      run({
        type: 'element.add',
        element: {
          id: uid(),
          kind: 'stroke',
          tool: tool === 'highlighter' ? 'highlighter' : 'pen',
          points: current.points,
          color,
          width: tool === 'highlighter' ? Math.max(width * 4, 16) : width,
        },
      });
      return;
    }
    if (current.kind === 'line') {
      if (Math.hypot(current.current.x - current.start.x, current.current.y - current.start.y) < 4) return;
      run({
        type: 'element.add',
        element: {
          id: uid(),
          kind: 'line',
          x1: current.start.x,
          y1: current.start.y,
          x2: current.current.x,
          y2: current.current.y,
          color,
          strokeWidth: Math.max(width, 2),
          arrow: current.arrow,
        },
      });
      return;
    }
    const box = normalizeBox(current.start.x, current.start.y, current.current.x, current.current.y);
    if (box.w < 6 || box.h < 6) return;
    run({
      type: 'element.add',
      element: {
        id: uid(),
        kind: 'shape',
        shape: current.shape,
        ...box,
        color,
        fill: 'transparent',
        strokeWidth: Math.max(width, 2),
      },
    });
  };

  const onWheel = (event: KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const oldScale = scale;
    const nextScale = clamp(event.evt.deltaY > 0 ? oldScale / 1.1 : oldScale * 1.1, 0.2, 3);
    const boardPoint = { x: (pointer.x - stagePos.x) / oldScale, y: (pointer.y - stagePos.y) / oldScale };
    setScale(nextScale);
    setStagePos({ x: pointer.x - boardPoint.x * nextScale, y: pointer.y - boardPoint.y * nextScale });
  };

  const zoomBy = (factor: number) => {
    const nextScale = clamp(scale * factor, 0.2, 3);
    const center = { x: size.width / 2, y: size.height / 2 };
    const boardPoint = { x: (center.x - stagePos.x) / scale, y: (center.y - stagePos.y) / scale };
    setScale(nextScale);
    setStagePos({ x: center.x - boardPoint.x * nextScale, y: center.y - boardPoint.y * nextScale });
  };

  const fitToContent = () => {
    if (doc.elements.length === 0) {
      setScale(1);
      setStagePos({ x: 0, y: 0 });
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const element of doc.elements) {
      const box = elementBounds(element);
      minX = Math.min(minX, box.x);
      minY = Math.min(minY, box.y);
      maxX = Math.max(maxX, box.x + box.w);
      maxY = Math.max(maxY, box.y + box.h);
    }
    const pad = 60;
    const nextScale = clamp(Math.min((size.width - pad * 2) / Math.max(maxX - minX, 1), (size.height - pad * 2) / Math.max(maxY - minY, 1)), 0.2, 2);
    setScale(nextScale);
    setStagePos({ x: (size.width - (maxX - minX) * nextScale) / 2 - minX * nextScale, y: (size.height - (maxY - minY) * nextScale) / 2 - minY * nextScale });
  };

  const deleteSelected = () => {
    if (selectedId) run({ type: 'element.delete', ids: [selectedId] });
    setSelectedId(null);
  };

  const duplicateSelected = () => {
    if (!selectedId) return;
    const newId = uid();
    run({ type: 'element.duplicate', id: selectedId, newId, dx: 24, dy: 24 });
    setSelectedId(newId);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        setHistory((h) => (event.shiftKey ? redo(h) : undo(h)));
        return;
      }
      if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        setHistory((h) => redo(h));
        return;
      }
      if (mod && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        duplicateSelected();
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedId) {
          event.preventDefault();
          deleteSelected();
        }
        return;
      }
      if (event.key === 'Escape') {
        setSelectedId(null);
        setEditor(null);
        return;
      }
      const shortcuts: Record<string, Tool> = {
        v: 'select', p: 'pen', h: 'highlighter', e: 'eraser', t: 'text', s: 'sticky',
        r: 'rect', o: 'ellipse', g: 'triangle', l: 'line', a: 'arrow',
      };
      const next = shortcuts[event.key.toLowerCase()];
      if (next && !mod) setTool(next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const download = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const url = stage.toDataURL({ pixelRatio: 2 });
    const link = document.createElement('a');
    link.download = `${title || 'board'}.png`;
    link.href = url;
    link.click();
  };

  const renderElement = (element: BoardElement) => {
    const common = {
      id: element.id,
      draggable: tool === 'select' && !editor,
      onClick: () => { if (tool === 'select') setSelectedId(element.id); },
      onTap: () => { if (tool === 'select') setSelectedId(element.id); },
      onDblClick: () => openEditorFor(element),
      onDblTap: () => openEditorFor(element),
    };

    if (element.kind === 'stroke') {
      const flat = element.points.flatMap((p) => [p.x, p.y]);
      return (
        <Line
          key={element.id}
          {...common}
          points={flat}
          stroke={element.color}
          strokeWidth={element.width}
          opacity={element.tool === 'highlighter' ? 0.35 : 1}
          tension={0.4}
          lineCap="round"
          lineJoin="round"
          globalCompositeOperation={element.tool === 'highlighter' ? 'multiply' : undefined}
          onDragEnd={(e) => {
            const node = e.currentTarget;
            const dx = node.x();
            const dy = node.y();
            node.position({ x: 0, y: 0 });
            run({ type: 'element.move', ids: [element.id], dx, dy });
          }}
        />
      );
    }

    if (element.kind === 'line') {
      return (
        <Arrow
          key={element.id}
          {...common}
          points={[element.x1, element.y1, element.x2, element.y2]}
          stroke={element.color}
          fill={element.color}
          strokeWidth={element.strokeWidth}
          pointerLength={element.arrow ? 14 : 0}
          pointerWidth={element.arrow ? 12 : 0}
          onDragEnd={(e) => {
            const node = e.currentTarget;
            const dx = node.x();
            const dy = node.y();
            node.position({ x: 0, y: 0 });
            run({ type: 'element.move', ids: [element.id], dx, dy });
          }}
        />
      );
    }

    if (element.kind === 'image') {
      return (
        <Group key={element.id} {...common} x={element.x} y={element.y} ref={(node) => { if (node) nodeRefs.current.set(element.id, node); }}>
          <Rect width={element.w} height={element.h} stroke="#94a3b8" dash={[8, 4]} fill="#f1f5f9" />
          <KonvaText width={element.w} height={element.h} align="center" verticalAlign="middle" text={element.alt || 'صورة'} fill="#64748b" fontSize={16} />
        </Group>
      );
    }

    return (
      <Group
        key={element.id}
        {...common}
        x={element.x}
        y={element.y}
        ref={(node) => {
          if (node) nodeRefs.current.set(element.id, node);
        }}
        onDragEnd={(e) => {
          const node = e.currentTarget;
          const dx = node.x() - element.x;
          const dy = node.y() - element.y;
          node.position({ x: element.x, y: element.y });
          run({ type: 'element.move', ids: [element.id], dx, dy });
        }}
        onTransformEnd={(e) => {
          const node = e.currentTarget;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          const next = {
            ...element,
            x: node.x(),
            y: node.y(),
            w: Math.max(element.kind === 'sticky' ? 80 : 20, element.w * scaleX),
            h: Math.max(element.kind === 'sticky' ? 60 : 20, element.h * scaleY),
          } as BoardElement;
          run({ type: 'element.replace', element: next });
        }}
      >
        {element.kind === 'shape' && element.shape === 'rect' && (
          <Rect width={element.w} height={element.h} stroke={element.color} strokeWidth={element.strokeWidth} fill={element.fill} cornerRadius={6} />
        )}
        {element.kind === 'shape' && element.shape === 'ellipse' && (
          <Ellipse x={element.w / 2} y={element.h / 2} radiusX={element.w / 2} radiusY={element.h / 2} stroke={element.color} strokeWidth={element.strokeWidth} fill={element.fill} />
        )}
        {element.kind === 'shape' && element.shape === 'triangle' && (
          <Line points={[element.w / 2, 0, element.w, element.h, 0, element.h]} closed stroke={element.color} strokeWidth={element.strokeWidth} fill={element.fill} lineJoin="round" />
        )}
        {element.kind === 'sticky' && (
          <>
            <Rect width={element.w} height={element.h} fill={element.color} cornerRadius={8} shadowColor="#0f172a" shadowOpacity={0.18} shadowBlur={10} shadowOffsetY={4} />
            <KonvaText
              x={14}
              y={14}
              width={element.w - 28}
              height={element.h - 28}
              text={element.text}
              fontSize={element.fontSize}
              fontFamily="IBM Plex Sans Arabic, Cairo, sans-serif"
              fill={element.textColor}
              wrap="word"
              ellipsize
              align={isArabic(element.text) ? 'right' : 'left'}
              direction={isArabic(element.text) ? 'rtl' : 'ltr'}
              verticalAlign="top"
            />
          </>
        )}
        {element.kind === 'text' && (
          <KonvaText
            width={element.w}
            height={element.h}
            text={element.text}
            fontSize={element.fontSize}
            fontFamily="IBM Plex Sans Arabic, Cairo, sans-serif"
            fontStyle={element.bold ? 'bold' : 'normal'}
            fill={element.color}
            align={element.align === 'middle' ? 'center' : element.align === 'end' ? (isArabic(element.text) ? 'left' : 'right') : (isArabic(element.text) ? 'right' : 'left')}
            direction={isArabic(element.text) ? 'rtl' : 'ltr'}
            wrap="word"
            lineHeight={1.35}
          />
        )}
      </Group>
    );
  };

  const editorScreen = editor
    ? { left: stagePos.x + editor.x * scale, top: stagePos.y + editor.y * scale, width: editor.w * scale, height: editor.h * scale }
    : null;

  return (
    <div className="board-shell bg-slate-100">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
        {onBack && (
          <button type="button" onClick={onBack} className="tool-btn !text-slate-700 hover:!bg-slate-100" aria-label="رجوع">
            <Icon name="back" className="h-5 w-5" />
          </button>
        )}
        <input
          className="min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1 text-base font-semibold text-slate-900 outline-none hover:border-slate-200 focus:border-emerald-400"
          value={title}
          onChange={(e) => onTitleChange?.(e.target.value)}
          aria-label="عنوان السبورة"
          maxLength={200}
        />
        <span className={`rounded-full px-2.5 py-1 text-xs ${saveState === 'error' ? 'bg-rose-100 text-rose-700' : saveState === 'offline' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>
          {SAVE_LABEL[saveState]}
        </span>
        <div className="flex items-center gap-1">
          <button type="button" className="tool-btn !text-slate-700 hover:!bg-slate-100 disabled:opacity-30" onClick={() => setHistory((h) => undo(h))} disabled={!canUndo(history)} aria-label="تراجع">
            <Icon name="undo" className="h-5 w-5" />
          </button>
          <button type="button" className="tool-btn !text-slate-700 hover:!bg-slate-100 disabled:opacity-30" onClick={() => setHistory((h) => redo(h))} disabled={!canRedo(history)} aria-label="إعادة">
            <Icon name="redo" className="h-5 w-5" />
          </button>
          <button type="button" className="tool-btn !text-slate-700 hover:!bg-slate-100 disabled:opacity-30" onClick={duplicateSelected} disabled={!selectedId} aria-label="نسخ">
            <Icon name="copy" className="h-5 w-5" />
          </button>
          <button type="button" className="tool-btn !text-slate-700 hover:!bg-slate-100 disabled:opacity-30" onClick={deleteSelected} disabled={!selectedId} aria-label="حذف">
            <Icon name="trash" className="h-5 w-5" />
          </button>
          {onSaveToLibrary && (
            <button type="button" className="tool-btn !text-slate-700 hover:!bg-slate-100" onClick={() => onSaveToLibrary(doc)} aria-label="حفظ في المكتبة" title="حفظ في المكتبة">
              <Icon name="library" className="h-5 w-5" />
            </button>
          )}
          <button type="button" className="tool-btn !text-slate-700 hover:!bg-slate-100" onClick={download} aria-label="تنزيل صورة" title="تنزيل PNG">
            <Icon name="download" className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="board-canvas-wrap board-stage" ref={wrapRef}>
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          scaleX={scale}
          scaleY={scale}
          x={stagePos.x}
          y={stagePos.y}
          draggable={tool === 'pan'}
          onDragEnd={(e) => setStagePos({ x: e.target.x(), y: e.target.y() })}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onWheel={onWheel}
          style={{ cursor: tool === 'pan' ? 'grab' : tool === 'select' ? 'default' : 'crosshair' }}
        >
          <Layer listening={false}>
            <Rect width={BOARD_WIDTH} height={BOARD_HEIGHT} fill={doc.background} shadowColor="#0f172a" shadowOpacity={0.12} shadowBlur={24} />
          </Layer>
          <Layer>
            {doc.elements.map(renderElement)}
            <Transformer ref={transformerRef} rotateEnabled={false} borderStroke="#059669" anchorStroke="#059669" anchorFill="#ffffff" anchorSize={9} />
          </Layer>
          <Layer listening={false}>
            {selected && (() => {
              const box = elementBounds(selected);
              return <Rect x={box.x} y={box.y} width={box.w} height={box.h} stroke="#059669" strokeWidth={2 / scale} dash={[8 / scale, 6 / scale]} />;
            })()}
            {draft?.kind === 'stroke' && (
              <Line points={draft.points.flatMap((p) => [p.x, p.y])} stroke={color} strokeWidth={tool === 'highlighter' ? Math.max(width * 4, 16) : width} opacity={tool === 'highlighter' ? 0.35 : 0.7} tension={0.4} lineCap="round" />
            )}
            {draft?.kind === 'line' && (
              <Arrow points={[draft.start.x, draft.start.y, draft.current.x, draft.current.y]} stroke={color} fill={color} strokeWidth={Math.max(width, 2)} pointerLength={draft.arrow ? 14 : 0} pointerWidth={draft.arrow ? 12 : 0} />
            )}
            {draft?.kind === 'shape' && (() => {
              const box = normalizeBox(draft.start.x, draft.start.y, draft.current.x, draft.current.y);
              if (draft.shape === 'rect') return <Rect x={box.x} y={box.y} width={box.w} height={box.h} stroke={color} strokeWidth={Math.max(width, 2)} />;
              if (draft.shape === 'ellipse') return <Ellipse x={box.x + box.w / 2} y={box.y + box.h / 2} radiusX={box.w / 2} radiusY={box.h / 2} stroke={color} strokeWidth={Math.max(width, 2)} />;
              return <Line points={[box.x + box.w / 2, box.y, box.x + box.w, box.y + box.h, box.x, box.y + box.h]} closed stroke={color} strokeWidth={Math.max(width, 2)} />;
            })()}
          </Layer>
        </Stage>

        {doc.elements.length === 0 && !editor && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="rounded-2xl bg-white/90 px-5 py-4 text-center shadow-elev-2">
              <p className="text-sm font-semibold text-slate-700">ابدأ بالرسم أو أضف ملاحظة</p>
              <p className="mt-1 text-xs text-slate-500">قلم، نص، أشكال، وملاحظات لاصقة — كلها تُحفظ تلقائياً</p>
            </div>
          </div>
        )}

        {editor && editorScreen && (
          <textarea
            ref={editorInputRef}
            dir="auto"
            className={editor.kind === 'sticky' ? 'sticky-editor' : 'text-editor'}
            style={{
              left: editorScreen.left,
              top: editorScreen.top,
              width: Math.max(editorScreen.width, 120),
              height: Math.max(editorScreen.height, 44),
              background: editor.kind === 'sticky' ? stickyColor : 'rgba(255,255,255,.97)',
              fontSize: editor.fontSize * scale,
            }}
            value={editor.value}
            onChange={(e) => setEditor((current) => (current ? { ...current, value: e.target.value } : current))}
            onBlur={commitEditor}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                commitEditor();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                setEditor(null);
              }
            }}
            placeholder={editor.kind === 'sticky' ? 'اكتب ملاحظة…' : 'اكتب نصاً…'}
          />
        )}
      </div>

      <div className="border-t border-slate-800 bg-[#080d1e] px-2 py-2">
        <div className="flex flex-wrap items-center justify-center gap-1">
          {TOOLS.map((item) => (
            <button
              key={item.tool}
              type="button"
              className="tool-btn"
              aria-pressed={tool === item.tool}
              aria-label={item.label}
              title={item.label}
              onClick={() => {
                setTool(item.tool);
                if (item.tool !== 'select') setSelectedId(null);
              }}
            >
              <Icon name={item.icon} className="h-5 w-5" />
            </button>
          ))}
          <span className="mx-1 h-8 w-px bg-white/15" />
          {PALETTE.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={`لون ${swatch}`}
              onClick={() => setColor(swatch)}
              className={`h-8 w-8 rounded-full border-2 transition ${color === swatch ? 'scale-110 border-white' : 'border-transparent'}`}
              style={{ background: swatch }}
            />
          ))}
          <span className="mx-1 h-8 w-px bg-white/15" />
          {WIDTHS.map((option) => (
            <button
              key={option}
              type="button"
              aria-label={`سمك ${option}`}
              onClick={() => setWidth(option)}
              className={`grid h-8 w-8 place-items-center rounded-lg ${width === option ? 'bg-white/20' : 'hover:bg-white/10'}`}
            >
              <span className="rounded-full bg-white" style={{ width: option + 2, height: option + 2 }} />
            </button>
          ))}
          {tool === 'sticky' && (
            <>
              <span className="mx-1 h-8 w-px bg-white/15" />
              {STICKY_COLORS.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  aria-label={`لون ملاحظة ${swatch}`}
                  onClick={() => setStickyColor(swatch)}
                  className={`h-8 w-8 rounded-md border-2 ${stickyColor === swatch ? 'border-white' : 'border-transparent'}`}
                  style={{ background: swatch }}
                />
              ))}
            </>
          )}
          <span className="mx-1 h-8 w-px bg-white/15" />
          <button type="button" className="tool-btn" onClick={() => zoomBy(1 / 1.2)} aria-label="تصغير">
            <Icon name="zoom-out" className="h-5 w-5" />
          </button>
          <span className="min-w-12 text-center text-xs text-slate-300">{Math.round(scale * 100)}%</span>
          <button type="button" className="tool-btn" onClick={() => zoomBy(1.2)} aria-label="تكبير">
            <Icon name="zoom-in" className="h-5 w-5" />
          </button>
          <button type="button" className="tool-btn" onClick={fitToContent} aria-label="ملاءمة">
            <Icon name="fit" className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
