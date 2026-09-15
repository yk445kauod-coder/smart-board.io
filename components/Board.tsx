import React, { useRef, useState, useMemo, useCallback } from 'react';
import { 
    ReactFlow, 
    Background, 
    Controls, 
    MiniMap, 
    ConnectionMode,
    Panel,
    useReactFlow,
    ReactFlowProvider
} from 'reactflow';
import type { Node, Edge } from 'reactflow';
import { getStroke } from 'perfect-freehand';
import { ToolType, ElementData, BoardTheme } from '../types';
import { THEMES } from '../data/themes';
import { 
  NoteNode, 
  ListNode, 
  ImageNode, 
  WordArtNode, 
  ShapeNode, 
  CodeNode, 
  SketchNode,
  ComparisonNode,
  TextNode,
  RulerNode,
  StickyNode,
  TableNode,
  EquationNode,
  ArrowNode,
  LineNode,
  DiagramNode,
  FlowchartNode,
  TimelineNode,
  AtlasNode,
  PeriodicNode
} from './BoardElements';

const nodeTypes = {
  note: NoteNode,
  list: ListNode,
  image: ImageNode,
  wordArt: WordArtNode,
  shape: ShapeNode,
  code: CodeNode,
  sketch: SketchNode,
  comparison: ComparisonNode,
  text: TextNode,
  ruler: RulerNode,
  sticky: StickyNode,
  table: TableNode,
  equation: EquationNode,
  arrow: ArrowNode,
  line: LineNode,
  diagram: DiagramNode,
  flowchart: FlowchartNode,
  timeline: TimelineNode,
  atlas: AtlasNode,
  periodic: PeriodicNode
};

interface SmartBoardProps {
  nodes: Node<ElementData>[];
  edges: Edge[];
  onNodesChange: any;
  onEdgesChange: any;
  onConnect: any;
  activeTool: ToolType;
  onAddSketch: (node: Node<ElementData>) => void;
  setNodes: any;
  onPaneClick: (event: React.MouseEvent) => void;
  penColor?: string;
  penSize?: number;
  onDeleteNode?: (id: string) => void;
  mode?: 'slides' | 'infinite';
  theme?: BoardTheme;
  /** Selected shape for drag-draw (rectangle, circle, triangle, diamond, hexagon, line, arrow) */
  activeShape?: string;
  /** Whether to auto-correct freehand into neat shapes */
  smartShapes?: boolean;
}

const BOARD_WIDTH = 1600;
const BOARD_HEIGHT = 900;

// Helper: Convert stroke points to SVG path
const getSvgPathFromStroke = (stroke: any[]) => {
  if (!stroke.length) return "";
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...stroke[0], "Q"]
  );
  d.push("Z");
  return d.join(" ");
};

// --- Freehand auto-correct: detect a sketch that looks like a neat shape ---
// Returns a canonical shape node or null.
const detectNeatShape = (
  rawPoints: number[][],
  color: string,
  vpX: number,
  vpY: number,
  zoom: number
): Node<ElementData> | null => {
  const pts = rawPoints.map(([x, y]) => ({ x, y }));
  if (pts.length < 3) return null;
  const n = pts.length;
  const start = pts[0];
  const end = pts[n - 1];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const isClosed = Math.sqrt(dx * dx + dy * dy) < Math.max((Math.abs(dx) + Math.abs(dy)) * 0.22, 10);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
  const w = maxX - minX, h = maxY - minY;
  if (w < 8 || h < 8) return null;
  // To world coordinates: Board layer is inside ReactFlow, points are in viewport space.
  const toWorld = (x: number, y: number) => ({ x: (x - vpX) / zoom, y: (y - vpY) / zoom });

  // Roughly circular?
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const rx = w / 2, ry = h / 2;
  let radialErr = 0;
  for (const p of pts) {
    const ex = (p.x - cx) / (rx || 1);
    const ey = (p.y - cy) / (ry || 1);
    radialErr += Math.abs(Math.sqrt(ex * ex + ey * ey) - 1);
  }
  radialErr /= n;
  const aspect = w / (h || 1);
  const areaCovered = (pts.reduce((acc, p, i) => {
    const next = pts[(i + 1) % n];
    return acc + (p.x * next.y - next.x * p.y);
  }, 0) / 2) / (w * h || 1);

  if (isClosed && radialErr < 0.32 && aspect > 0.7 && aspect < 1.45 && areaCovered > 0.45) {
    const p = toWorld(minX, minY);
    return {
      id: `shape-${Date.now()}`,
      type: 'shape',
      position: { x: p.x, y: p.y },
      data: { id: `shape-${Date.now()}`, type: 'shape', shapeType: 'ellipse', color, width: w / zoom, height: h / zoom },
    };
  }

  // Roughly a line / arrow?
  const length = Math.sqrt(dx * dx + dy * dy);
  if (!isClosed && length > 60) {
    // Orthogonality: how straight is the path relative to the start-end segment?
    let straightErr = 0;
    for (const p of pts) {
      const t = Math.max(0, Math.min(1, ((p.x - start.x) * dx + (p.y - start.y) * dy) / (length * length)));
      const qx = start.x + t * dx, qy = start.y + t * dy;
      straightErr += Math.sqrt((p.x - qx) ** 2 + (p.y - qy) ** 2);
    }
    straightErr /= n;
    if (straightErr < (length * 0.12)) {
      const s = toWorld(start.x, start.y);
      const en = toWorld(end.x, end.y);
      return {
        id: `line-${Date.now()}`,
        type: 'line',
        position: { x: Math.min(s.x, en.x), y: Math.min(s.y, en.y) },
        data: {
          id: `line-${Date.now()}`,
          type: 'line',
          x1: s.x - Math.min(s.x, en.x),
          y1: s.y - Math.min(s.y, en.y),
          x2: en.x - Math.min(s.x, en.x),
          y2: en.y - Math.min(s.y, en.y),
          color,
        },
      };
    }
  }

  // Roughly a rectangle?
  if (isClosed && aspect > 0.55 && aspect < 1.8 && areaCovered > 0.5 && radialErr > 0.32) {
    const p = toWorld(minX, minY);
    return {
      id: `shape-${Date.now()}`,
      type: 'shape',
      position: { x: p.x, y: p.y },
      data: { id: `shape-${Date.now()}`, type: 'shape', shapeType: 'rectangle', color, width: w / zoom, height: h / zoom },
    };
  }

  return null;
};

const SmartBoard: React.FC<SmartBoardProps> = ({ 
  nodes, 
  edges, 
  onNodesChange, 
  onEdgesChange, 
  onConnect,
  activeTool,
  onAddSketch,
  onPaneClick,
  penColor = '#000000',
  penSize = 6,
  onDeleteNode,
  mode = 'infinite',
  theme = 'white',
  activeShape,
  smartShapes = true,
}) => {
  const themeSpec = THEMES[theme] || THEMES.white;
  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState<number[][]>([]);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  // Track pressure data incrementally O(1) to avoid O(N) array scans on every pointermove frame
  const hasCustomPressureRef = useRef<boolean>(false);
  
  const { getViewport } = useReactFlow();

  const isDrawTool = activeTool === 'pen' || activeTool === 'highlighter';
  const isShapeTool = activeTool === 'add-shape' && !!activeShape;

  // --- Eraser Logic ---
  const handleNodeClick = (event: React.MouseEvent, node: Node) => {
      if (activeTool === 'eraser' && onDeleteNode) {
          onDeleteNode(node.id);
      }
  };

  const handleNodeMouseEnter = (event: React.MouseEvent, node: Node) => {
      if (activeTool === 'eraser' && event.buttons === 1 && onDeleteNode) {
          onDeleteNode(node.id);
      }
  };
  

  // --- Drawing Logic ---

  const handlePointerDown = (e: React.PointerEvent) => {
      if (!isDrawTool && !isShapeTool) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as Element).setPointerCapture(e.pointerId);
      
      setIsDrawing(true);
      
      const bbox = svgRef.current?.getBoundingClientRect();
      if(bbox) {
          const x = e.clientX - bbox.left;
          const y = e.clientY - bbox.top;
          const pressure = e.pressure !== undefined ? e.pressure : 0.5;
          hasCustomPressureRef.current = pressure !== 0.5;
          setPoints([[x, y, pressure]]);
          setDragStart({ x, y });
          setDragEnd({ x, y });
      }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (!isDrawing || (!isDrawTool && !isShapeTool)) return;
      e.preventDefault();
      
      const bbox = svgRef.current?.getBoundingClientRect();
      if(bbox) {
          if (isShapeTool) {
              const x = e.clientX - bbox.left;
              const y = e.clientY - bbox.top;
              setDragEnd({ x, y });
              return;
          }
          const nativeEvent = e.nativeEvent as PointerEvent;
          const events = nativeEvent.getCoalescedEvents ? nativeEvent.getCoalescedEvents() : [nativeEvent];
          
          const newPoints = events.map((evt: PointerEvent) => {
              const x = evt.clientX - bbox.left;
              const y = evt.clientY - bbox.top;
              const pressure = evt.pressure !== undefined && evt.pressure !== 0 ? evt.pressure : 0.5;
              if (pressure !== 0.5) hasCustomPressureRef.current = true;
              return [x, y, pressure];
          });
          
          setPoints(prev => [...prev, ...newPoints]);
      }
  };

  // Commit a drag-drawn shape node.
  const commitShape = useCallback((start: {x:number;y:number}, end: {x:number;y:number}) => {
    (window as any).__lastShapeDragCommit = Date.now();
    const { x: vpX, y: vpY, zoom } = getViewport();
    const shape = activeShape || 'rectangle';

    const sx = (start.x - vpX) / zoom, sy = (start.y - vpY) / zoom;
    const ex = (end.x - vpX) / zoom, ey = (end.y - vpY) / zoom;

    // Normalize to bounding box in world coords
    const minX = Math.min(sx, ex), minY = Math.min(sy, ey);
    const w = Math.abs(ex - sx), h = Math.abs(ey - sy);
    const size = Math.max(w, h, 6);

    if (shape === 'line' || shape === 'arrow') {
      const ntype = shape === 'arrow' ? 'arrow' : 'line';
      const c = penColor;
      const nid = `shape-${Date.now()}`;
      onAddSketch({
        id: nid,
        type: ntype,
        position: { x: minX, y: minY },
        data: {
          id: nid,
          type: ntype,
          color: c,
          points: shape === 'arrow'
            ? [{ x: sx - minX, y: sy - minY }, { x: ex - minX, y: ey - minY }]
            : undefined,
          x1: sx - minX, y1: sy - minY,
          x2: ex - minX, y2: ey - minY,
        } as any,
      });
      return;
    }

    const nid = `shape-${Date.now()}`;
    const c = penColor;
    onAddSketch({
      id: nid,
      type: 'shape',
      position: { x: minX, y: minY },
      data: {
        id: nid,
        type: 'shape',
        shapeType: shape,
        color: c,
        width: w,
        height: h,
      } as any,
    });
  }, [activeShape, penColor, onAddSketch, getViewport]);

  const handlePointerUp = (e: React.PointerEvent) => {
      if (!isDrawing) return;
      (e.target as Element).releasePointerCapture(e.pointerId);
      setIsDrawing(false);

      if (isShapeTool && dragStart && dragEnd) {
        commitShape(dragStart, dragEnd);
        setPoints([]);
        setDragStart(null);
        setDragEnd(null);
        return;
      }

      if (points.length > 1) {
          const { x: vpX, y: vpY, zoom } = getViewport();
          const isStylus = e.pointerType === 'pen';
          // Use O(1) incrementally tracked pressure ref instead of scanning all points
          const hasPressureData = isStylus || hasCustomPressureRef.current;

          // Auto-correct freehand into a neat shape
          if (smartShapes && activeTool === 'pen') {
            const neat = detectNeatShape(points, penColor, vpX, vpY, zoom);
            if (neat) {
              onAddSketch(neat);
              setPoints([]);
              return;
            }
          }

          const worldPoints = points.map(([x, y, p]) => {
              const wx = (x - vpX) / zoom;
              const wy = (y - vpY) / zoom;
              return [wx, wy, p];
          });

          const currentSize = activeTool === 'highlighter' ? 24 : penSize;
          const options = {
            size: currentSize / zoom, 
            thinning: 0.6,
            smoothing: 0.7,
            streamline: 0.6,
            simulatePressure: !hasPressureData,
            last: true
          };
          
          const stroke = getStroke(worldPoints, options);
          
          const xs = stroke.map(p => p[0]);
          const ys = stroke.map(p => p[1]);
          const minX = Math.min(...xs);
          const minY = Math.min(...ys);
          const maxX = Math.max(...xs);
          const maxY = Math.max(...ys);
          
          const width = Math.max(maxX - minX, 1);
          const height = Math.max(maxY - minY, 1);
          
          const relativeStroke = stroke.map(([x, y]) => [x - minX, y - minY]);
          const pathData = getSvgPathFromStroke(relativeStroke);

          onAddSketch({
              id: `sketch-${Date.now()}`,
              type: 'sketch',
              position: { x: minX, y: minY }, 
              data: {
                  id: `sketch-${Date.now()}`,
                  type: 'sketch',
                  svgPath: pathData,
                  strokeColor: activeTool === 'highlighter' ? (themeSpec.accentInk || 'rgba(255, 235, 59, 0.5)') : penColor,
                  width: width,
                  height: height,
                  isHighlighter: activeTool === 'highlighter',
                  isFilled: true
              }
          });
      }
      hasCustomPressureRef.current = false;
      setPoints([]);
      setDragStart(null);
      setDragEnd(null);
  };

  const currentPath = useMemo(() => {
      if (isShapeTool) {
        // Live drag-shape preview
        if (!dragStart || !dragEnd) return null;
        const { x: vpX, y: vpY, zoom } = getViewport();
        const sx = (dragStart.x - vpX) / zoom, sy = (dragStart.y - vpY) / zoom;
        const ex = (dragEnd.x - vpX) / zoom, ey = (dragEnd.y - vpY) / zoom;
        const minX = Math.min(sx, ex), minY = Math.min(sy, ey);
        const w = Math.abs(ex - sx), h = Math.abs(ey - sy);
        const shape = activeShape || 'rectangle';
        const c = penColor;

        if (shape === 'line' || shape === 'arrow') {
          return {
            elements: (
              <>
                {shape === 'arrow' && (
                  <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={c} strokeWidth={3} markerEnd="url(#board-arrow)" />
                )}
                {shape === 'line' && (
                  <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={c} strokeWidth={3} />
                )}
              </>
            ),
          };
        }

        let el: React.ReactNode = null;
        if (shape === 'rectangle') el = <rect x={minX} y={minY} width={w} height={h} fill="none" stroke={c} strokeWidth={3} />;
        else if (shape === 'circle' || shape === 'ellipse') el = <ellipse cx={minX + w/2} cy={minY + h/2} rx={w/2} ry={h/2} fill="none" stroke={c} strokeWidth={3} />;
        else if (shape === 'tri' || shape === 'triangle') el = <polygon points={`${minX + w/2},${minY} ${minX},${minY+h} ${minX+w},${minY+h}`} fill="none" stroke={c} strokeWidth={3} />;
        else if (shape === 'diamond') el = <polygon points={`${minX + w/2},${minY} ${minX+w},${minY+h/2} ${minX+w/2},${minY+h} ${minX},${minY+h/2}`} fill="none" stroke={c} strokeWidth={3} />;
        else if (shape === 'hexagon') {
          const pts = [0, 0.5, 1, 1.5, 2, 2.5].map(i => {
            const a = (Math.PI / 3) * (i + 0.5);
            return `${minX + w/2 + (w/2) * Math.cos(a)},${minY + h/2 + (h/2) * Math.sin(a)}`;
          });
          el = <polygon points={pts.join(' ')} fill="none" stroke={c} strokeWidth={3} />;
        }
        return { elements: el };
      }

      if (points.length < 2) return '';
      const currentSize = activeTool === 'highlighter' ? 24 : penSize;
      // Optimization: use O(1) incremental pressure tracking (hasCustomPressureRef)
      // instead of O(N) points.every scan on every pointer move frame
      const options = {
        size: currentSize,
        thinning: 0.6,
        smoothing: 0.7,
        streamline: 0.6,
        simulatePressure: !hasCustomPressureRef.current
      };
      const stroke = getStroke(points, options);
      return getSvgPathFromStroke(stroke);
  }, [points, activeTool, penSize, isShapeTool, dragStart, dragEnd, penColor, getViewport]);

  const isSlides = mode === 'slides';

  return (
    <div
      className={`w-full h-full relative touch-none flex items-center justify-center ${isSlides ? 'bg-gray-200 p-4' : 'bg-board'}`}
      dir="ltr"
    >
        <div 
            className={`relative shadow-2xl rounded-lg overflow-hidden ${isSlides ? 'border-8 border-gray-300' : ''}`}
            style={{ 
                width: '100%', 
                height: '100%', 
                backgroundColor: themeSpec.bg,
                maxWidth: isSlides ? `${BOARD_WIDTH}px` : 'none',
                maxHeight: isSlides ? `${BOARD_HEIGHT}px` : 'none',
                aspectRatio: isSlides ? '16 / 9' : undefined,
                backgroundImage: themeSpec.dot
                  ? `radial-gradient(circle at 1px 1px, ${themeSpec.grid} 1px, transparent 1.4px)`
                  : 'none',
                backgroundSize: themeSpec.dot ? '24px 24px' : 'auto',
            }}
        >
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                connectionMode={ConnectionMode.Loose}
                minZoom={0.5}
                maxZoom={3}
                translateExtent={isSlides ? [[0, 0], [BOARD_WIDTH, BOARD_HEIGHT]] : [[-20000, -20000], [20000, 20000]]}
                defaultViewport={{ x: 0, y: 0, zoom: isSlides ? 0.8 : 1 }}
                panOnDrag={activeTool === 'pan'} 
                panOnScroll={false}
                zoomOnScroll={true}
                selectionOnDrag={activeTool === 'pointer'}
                nodesDraggable={activeTool === 'pointer'}
                elementsSelectable={activeTool === 'pointer' || activeTool === 'eraser'}
                nodesConnectable={activeTool === 'pointer'}
                onPaneClick={onPaneClick}
                onNodeClick={handleNodeClick}
                onNodeMouseEnter={handleNodeMouseEnter}
                proOptions={{ hideAttribution: true }}
                className={`${isDrawTool ? 'cursor-pen' : ''} ${activeTool === 'eraser' ? 'cursor-eraser' : ''} ${activeTool === 'pan' ? 'cursor-grab active:cursor-grabbing' : ''}`}
            >
                <Background gap={20} color={themeSpec.grid} />
                <Controls />
                {!themeSpec.dark && <MiniMap style={{ height: 100, width: 150 }} zoomable pannable />}
                <Panel position="top-right" className={`${themeSpec.dark ? 'bg-black/40 text-white/80' : 'bg-white/80 text-gray-500'} p-2 rounded text-xs`}>
                    {BOARD_WIDTH}x{BOARD_HEIGHT} px
                </Panel>
            </ReactFlow>

            {(isDrawTool || isShapeTool) && (
                <div 
                    className="absolute inset-0 z-50 touch-none"
                    style={{ pointerEvents: (isDrawTool || isShapeTool) ? 'auto' : 'none' }}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                >
                    <svg 
                        ref={svgRef}
                        className="w-full h-full"
                        style={{ pointerEvents: 'none' }} 
                        viewBox={`0 0 ${svgRef.current?.clientWidth || BOARD_WIDTH} ${svgRef.current?.clientHeight || BOARD_HEIGHT}`}
                    >
                        <defs>
                            <marker id="board-arrow" markerWidth="12" markerHeight="8" refX="10" refY="4" orient="auto">
                                <polygon points="0 0, 12 4, 0 8" fill={penColor} />
                            </marker>
                        </defs>
                        {currentPath && typeof currentPath === 'object' && (
                          <>
                            {currentPath.elements}
                          </>
                        )}
                        {currentPath && typeof currentPath === 'string' && (
                            <path 
                                d={currentPath}
                                fill={activeTool === 'highlighter' ? (themeSpec.accentInk || 'rgba(255, 235, 59, 0.5)') : penColor}
                                stroke="none"
                            />
                        )}
                    </svg>
                </div>
            )}
        </div>
    </div>
  );
};

export default SmartBoard;