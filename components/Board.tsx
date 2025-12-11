import React, { useRef, useState, useMemo } from 'react';
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
import { ToolType, ElementData } from '../types';
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
  RulerNode
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
  ruler: RulerNode
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
}) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState<number[][]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  
  const { getViewport } = useReactFlow();

  const isDrawTool = activeTool === 'pen' || activeTool === 'highlighter';

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
      if (!isDrawTool) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as Element).setPointerCapture(e.pointerId);
      
      setIsDrawing(true);
      
      const bbox = svgRef.current?.getBoundingClientRect();
      if(bbox) {
          const x = e.clientX - bbox.left;
          const y = e.clientY - bbox.top;
          const pressure = e.pressure !== undefined ? e.pressure : 0.5;
          setPoints([[x, y, pressure]]);
      }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (!isDrawing || !isDrawTool) return;
      e.preventDefault();
      
      const bbox = svgRef.current?.getBoundingClientRect();
      if(bbox) {
          const nativeEvent = e.nativeEvent as PointerEvent;
          const events = nativeEvent.getCoalescedEvents ? nativeEvent.getCoalescedEvents() : [nativeEvent];
          
          const newPoints = events.map((evt: PointerEvent) => {
              const x = evt.clientX - bbox.left;
              const y = evt.clientY - bbox.top;
              const pressure = evt.pressure !== undefined && evt.pressure !== 0 ? evt.pressure : 0.5;
              return [x, y, pressure];
          });
          
          setPoints(prev => [...prev, ...newPoints]);
      }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      if (!isDrawing) return;
      (e.target as Element).releasePointerCapture(e.pointerId);
      setIsDrawing(false);

      if (points.length > 1) {
          const { x: vpX, y: vpY, zoom } = getViewport();
          const isStylus = e.pointerType === 'pen';
          const hasPressureData = isStylus || points.some(p => Math.abs(p[2] - 0.5) > 0.05);

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
                  strokeColor: activeTool === 'highlighter' ? 'rgba(255, 235, 59, 0.5)' : penColor,
                  width: width,
                  height: height,
                  isHighlighter: activeTool === 'highlighter',
                  isFilled: true
              }
          });
      }
      setPoints([]);
  };

  const currentPath = useMemo(() => {
      if (points.length < 2) return '';
      const currentSize = activeTool === 'highlighter' ? 24 : penSize;
      const options = {
        size: currentSize,
        thinning: 0.6,
        smoothing: 0.7,
        streamline: 0.6,
        simulatePressure: points.every(p => p[2] === 0.5)
      };
      const stroke = getStroke(points, options);
      return getSvgPathFromStroke(stroke);
  }, [points, activeTool, penSize]);

  return (
    <div className="w-full h-full relative touch-none bg-gray-200 flex items-center justify-center p-4" dir="ltr">
        <div 
            className="relative shadow-2xl bg-white rounded-lg overflow-hidden border-8 border-gray-300"
            style={{ 
                width: '100%', 
                height: '100%', 
                maxWidth: `${BOARD_WIDTH}px`, 
                maxHeight: `${BOARD_HEIGHT}px`,
                aspectRatio: '16 / 9'
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
                translateExtent={[[0, 0], [BOARD_WIDTH, BOARD_HEIGHT]]}
                defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
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
                <Background gap={20} color="#e1e1e1" />
                <Controls />
                <MiniMap style={{ height: 100, width: 150 }} zoomable pannable />
                <Panel position="top-right" className="bg-white/80 p-2 rounded text-xs text-gray-500">
                    {BOARD_WIDTH}x{BOARD_HEIGHT} px
                </Panel>
            </ReactFlow>

            {isDrawTool && (
                <div 
                    className="absolute inset-0 z-50 touch-none"
                    style={{ pointerEvents: isDrawing ? 'auto' : 'none' }}
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
                        {currentPath && (
                            <path 
                                d={currentPath}
                                fill={activeTool === 'highlighter' ? 'rgba(255, 235, 59, 0.5)' : penColor}
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