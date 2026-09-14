import React, { memo, useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeResizer } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { ElementData } from '../types';
import { WORLD, EGYPT, WORLD_PINS, PIN_BY_ID, AtlasRegion } from '../data/atlas';
import { ELEMENT_BY_NUMBER, CATEGORY_COLOR } from '../data/periodic';

const getFontClass = (text: string) => {
    const isArabic = /[\u0600-\u06FF]/.test(text || "");
    return isArabic ? 'font-ar' : 'font-en';
};

const DeleteHandle = ({ id, onDelete }: { id: string, onDelete?: (id: string) => void }) => {
    if (!onDelete) return null;
    return (
        <div className="absolute -top-3 -right-3 opacity-0 group-hover:opacity-100 z-50 pointer-events-auto transition-opacity duration-200">
            <button 
                className="bg-white text-red-500 hover:bg-red-50 border border-red-100 w-8 h-8 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110"
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete(id);
                }}
                onPointerDown={(e) => e.stopPropagation()} 
                title="Delete Element"
            >
                <i className="fa-solid fa-xmark text-lg"></i>
            </button>
        </div>
    );
};

export const RulerNode = memo(({ id, data, selected }: NodeProps<ElementData>) => {
    const rotation = data.rotation || 0;
    const width = data.width || 400;
    const height = data.height || 50;
    
    const onRotateStart = (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        const startRotation = rotation;
        let lastClientX = e.clientX;

        const onPointerMove = (moveEvent: PointerEvent) => {
            const dx = moveEvent.clientX - lastClientX;
            lastClientX = moveEvent.clientX;
            const newRotation = (data.rotation || 0) + dx; 
            if ((window as any).updateNodeData) {
                (window as any).updateNodeData(id, { rotation: newRotation });
            }
        };

        const onPointerUp = () => {
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', onPointerUp);
        };

        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
    };

    const markings = [];
    if (width && height) {
        for (let i = 0; i <= width; i += 10) {
            let line_height = 10;
            if (i % 100 === 0) line_height = 25;
            else if (i % 50 === 0) line_height = 18;
            
            markings.push(<line key={`l-${i}`} x1={i} y1={height} x2={i} y2={height - line_height} stroke="black" strokeWidth="1" />);
            
            if (i % 50 === 0 && i > 0) {
                 markings.push(<text key={`t-${i}`} x={i} y={height - 30} textAnchor="middle" fontSize="12" fill="black" className="select-none">{i/10}</text>);
            }
        }
    }

    return (
        <div 
            className="relative group react-flow__node-ruler" 
            style={{ 
                width: width, 
                height: height, 
                transform: `rotate(${rotation}deg)` 
            }}
        >
            <NodeResizer 
                isVisible={selected} 
                minWidth={100} 
                minHeight={50}
                maxHeight={50}
                handleClassName="bg-indigo-500 w-2 h-2 rounded-full border-2 border-white shadow-lg"
                lineClassName="border-indigo-500"
            />
            {selected && (
                 <div className="absolute -top-4 -left-4 pointer-events-auto z-10">
                     <button 
                        className="bg-red-500 text-white w-6 h-6 rounded-full shadow-md hover:bg-red-600 transition-colors flex items-center justify-center"
                        onClick={(e) => { e.stopPropagation(); if((window as any).deleteNode) (window as any).deleteNode(id); }}
                        onPointerDown={(e) => e.stopPropagation()} 
                     >
                         <i className="fa-solid fa-trash-can text-[10px]"></i>
                     </button>
                 </div>
            )}


            {selected && (
                <div 
                    className="absolute -right-8 top-1/2 -translate-y-1/2 w-6 h-6 bg-green-500 text-white rounded-full shadow-md hover:bg-green-600 transition-colors flex items-center justify-center cursor-alias z-10 pointer-events-auto"
                    onPointerDown={onRotateStart}
                    title="Drag to rotate"
                >
                    <i className="fa-solid fa-arrows-rotate text-xs"></i>
                </div>
            )}
            
            <svg width="100%" height="100%" className="bg-yellow-200/90 shadow-xl rounded border border-yellow-300 overflow-visible backdrop-blur-sm">
                <rect width="100%" height="100%" fill="url(#ruler-pattern)" />
                {markings}
                <defs>
                  <pattern id="ruler-pattern" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="10" height="10" fill="rgba(0,0,0,0.05)"></rect>
                    <rect x="10" y="10" width="10" height="10" fill="rgba(0,0,0,0.05)"></rect>
                  </pattern>
                </defs>
            </svg>
        </div>
    );
});


export const NoteNode = memo(({ id, data, selected }: NodeProps<ElementData>) => {
    const [isEditing, setIsEditing] = useState(false);
    const [content, setContent] = useState(data.content || '');
    const fontClass = getFontClass(content);
    const rotation = data.rotation || (Math.random() - 0.5) * 2; 

    useEffect(() => { setContent(data.content || ''); }, [data.content]);

    const handleDoubleClick = () => {
        if ((window as any).isPointerTool?.()) setIsEditing(true);
    };

    const handleBlur = () => {
        setIsEditing(false);
        if ((window as any).updateNodeData) (window as any).updateNodeData(id, { content });
    };

    const handleInput = (e: React.FormEvent<HTMLParagraphElement>) => setContent(e.currentTarget.textContent || '');
    
    return (
        <div className="relative group" onDoubleClick={handleDoubleClick}>
            <Handle type="target" position={Position.Top} className="opacity-0" />
            <DeleteHandle id={data.id} onDelete={(window as any).deleteNode} />
            <div 
                className={`p-5 w-60 min-h-[160px] flex flex-col items-center justify-center text-center relative transition-all duration-300
                 ${selected ? 'ring-4 ring-indigo-300 shadow-2xl scale-105' : 'shadow-lg hover:shadow-xl hover:-translate-y-1'}`}
                style={{ 
                    backgroundColor: data.color || '#F7FFF7',
                    transform: `rotate(${rotation}deg)`, 
                    borderRadius: '2px',
                    borderBottomRightRadius: '25px'
                }}
            >
                {/* Folded corner effect */}
                <div 
                    className="absolute bottom-0 right-0 w-8 h-8 z-10" 
                    style={{ 
                        background: 'linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.1) 50%)',
                        borderTopLeftRadius: '4px'
                    }}
                ></div>
                
                {/* Pin element */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-red-400 shadow-sm z-20 border border-red-500"></div>

                {/* Content Container - Ensure bold tags pop */}
                <style>{`
                    .note-content b, .note-content strong {
                        font-weight: 800;
                        color: #000;
                        background-color: rgba(255,255,255,0.3);
                        padding: 0 2px;
                        border-radius: 2px;
                    }
                `}</style>

                <p 
                    contentEditable={isEditing}
                    suppressContentEditableWarning
                    onInput={handleInput}
                    onBlur={handleBlur}
                    className={`note-content text-xl font-medium break-words w-full text-gray-800 ${fontClass} outline-none ${isEditing ? 'cursor-text' : 'cursor-pointer'}`}
                    dir="auto"
                    dangerouslySetInnerHTML={{ __html: isEditing ? content : content.replace(/\n/g, '<br />') }}
                />
            </div>
            <Handle type="source" position={Position.Bottom} className="opacity-0" />
        </div>
    );
});

export const ListNode = memo(({ data, selected }: NodeProps<ElementData>) => {
  const fontClass = getFontClass(data.title || (data.items?.[0] || ""));
  
  return (
    <div className="relative group">
       <Handle type="target" position={Position.Top} className="opacity-0" />
       <DeleteHandle id={data.id} onDelete={(window as any).deleteNode} />
      <div 
        className={`w-72 bg-white shadow-xl rounded-2xl overflow-hidden transition-all duration-300 border border-gray-100
            ${selected ? 'ring-4 ring-indigo-300 shadow-2xl scale-[1.02]' : 'hover:shadow-2xl'}`}
      >
        <div 
            className="px-6 py-4 border-b border-gray-100" 
            style={{ backgroundColor: data.color || '#F3F4F6' }}
        >
             {data.title && <div className={`font-bold text-xl text-gray-800 ${fontClass}`}>{data.title}</div>}
        </div>
        
        <div className="p-6 bg-white">
            <style>{`
                    .list-content b, .list-content strong {
                        font-weight: 800;
                        color: #1a202c;
                    }
            `}</style>
            <ul className="space-y-3 list-content">
            {data.items?.map((item, idx) => (
                <li key={idx} className={`text-lg text-gray-600 flex items-start gap-3 ${fontClass}`} dir="auto">
                <div className="mt-1.5 w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0"></div>
                <span className="leading-snug" dangerouslySetInnerHTML={{__html: item}}></span>
                </li>
            ))}
            </ul>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
});

export const ImageNode = memo(({ data, selected }: NodeProps<ElementData>) => {
  const rotation = data.rotation || 0;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  return (
    <div className="relative group" style={{ transform: `rotate(${rotation}deg)` }}>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <DeleteHandle id={data.id} onDelete={(window as any).deleteNode} />
      <div className={`p-4 bg-white shadow-xl rounded-xl border border-gray-100 transition-all ${selected ? 'ring-4 ring-indigo-300 scale-105' : 'hover:shadow-2xl'}`}>
        <div className="bg-gray-50 rounded-lg overflow-hidden relative flex items-center justify-center" style={{ width: data.width || 288, height: data.height || 256 }}>
           {data.url && !error ? (
             <>
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
                        <span className="material-symbols-rounded animate-spin text-2xl text-indigo-400">progress_activity</span>
                    </div>
                )}
                <img 
                    src={data.url} 
                    alt={data.description}
                    className={`w-full h-full object-cover transition-opacity duration-500 ${loading ? 'opacity-0' : 'opacity-100'}`}
                    loading="lazy"
                    onLoad={() => setLoading(false)}
                    onError={() => { setLoading(false); setError(true); }}
                />
             </>
           ) : (
             <div className="text-gray-400 flex flex-col items-center gap-2">
                <span className="material-symbols-rounded text-3xl opacity-50">image</span>
                <span className="text-xs font-medium">{error ? "Failed to load" : "No Image"}</span>
             </div>
           )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
});

export const WordArtNode = memo(({ id, data, selected }: NodeProps<ElementData>) => {
    const [isEditing, setIsEditing] = useState(false);
    const [text, setText] = useState(data.text || '');
    const fontClass = getFontClass(text);

    useEffect(() => { setText(data.text || ''); }, [data.text]);

    const handleDoubleClick = () => {
        if ((window as any).isPointerTool?.()) setIsEditing(true);
    };

    const handleBlur = () => {
        setIsEditing(false);
        if ((window as any).updateNodeData) (window as any).updateNodeData(id, { text });
    };

    const handleInput = (e: React.FormEvent<HTMLHeadingElement>) => setText(e.currentTarget.textContent || '');

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLElement).blur();
        }
    };

    return (
        <div className="relative group" onDoubleClick={handleDoubleClick}>
            <Handle type="target" position={Position.Left} className="opacity-0" />
            <DeleteHandle id={data.id} onDelete={(window as any).deleteNode} />
            <h1
                contentEditable={isEditing}
                suppressContentEditableWarning
                onInput={handleInput}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className={`text-7xl font-bold select-none whitespace-pre-wrap text-center max-w-[800px] outline-none ${fontClass} tracking-tight transition-all duration-300 ${selected ? 'scale-105' : ''} ${isEditing ? 'cursor-text opacity-70' : 'cursor-pointer'}`}
                style={{ 
                    color: data.color || '#2d3436', 
                    textShadow: '2px 2px 0px rgba(0,0,0,0.1), 4px 4px 0px rgba(0,0,0,0.05)',
                    lineHeight: '1.2'
                }}
                dir="auto"
            >
                {text}
            </h1>
            <Handle type="source" position={Position.Right} className="opacity-0" />
        </div>
    );
});

export const TextNode = memo(({ id, data, selected }: NodeProps<ElementData>) => {
    const [isEditing, setIsEditing] = useState(false);
    const [text, setText] = useState(data.text || 'Type something...');
    const fontClass = getFontClass(text);

    useEffect(() => { setText(data.text || 'Type something...'); }, [data.text]);

    const handleDoubleClick = () => {
        if ((window as any).isPointerTool?.()) setIsEditing(true);
    };

    const handleBlur = () => {
        setIsEditing(false);
        if ((window as any).updateNodeData) (window as any).updateNodeData(id, { text });
    };

    const handleInput = (e: React.FormEvent<HTMLDivElement>) => setText(e.currentTarget.textContent || '');

    return (
        <div className="relative group" onDoubleClick={handleDoubleClick} style={{ width: data.width || 300, height: data.height || 'auto' }}>
            <NodeResizer minWidth={150} minHeight={40} isVisible={selected} handleClassName="bg-indigo-500 w-2 h-2 rounded-full border-2 border-white shadow-lg" />
            <Handle type="target" position={Position.Top} className="opacity-0" />
            <DeleteHandle id={data.id} onDelete={(window as any).deleteNode} />
            <style>{`
                    .text-content b, .text-content strong {
                        font-weight: 800;
                        color: #000;
                    }
            `}</style>
            <div
                contentEditable={isEditing}
                suppressContentEditableWarning
                onInput={handleInput}
                onBlur={handleBlur}
                className={`text-content p-4 text-xl leading-relaxed break-words w-full h-full outline-none border-l-4 border-transparent hover:border-gray-300 focus:border-indigo-500 transition-colors text-gray-700 ${fontClass} ${isEditing ? 'cursor-text bg-white/50 rounded-r' : 'cursor-pointer'}`}
                dir="auto"
                dangerouslySetInnerHTML={{ __html: isEditing ? text : text.replace(/\n/g, '<br />') }}
            />
            <Handle type="source" position={Position.Bottom} className="opacity-0" />
        </div>
    );
});

export const ShapeNode = memo(({ data, selected }: NodeProps<ElementData>) => {
  const bg = data.color || '#4ECDC4';
  const w = data.width || (data.shapeType === 'circle' || data.shapeType === 'ellipse' ? 160 : 192);
  const h = data.height || (data.shapeType === 'circle' ? 160 : data.shapeType === 'ellipse' ? 128 : 128);
  const border = data.borderColor || 'transparent';

  return (
    <div className="relative group">
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <DeleteHandle id={data.id} onDelete={(window as any).deleteNode} />
      <div className={`transition-transform duration-300 ${selected ? 'scale-105 drop-shadow-xl' : 'drop-shadow-md hover:scale-105'}`}>
      {data.shapeType === 'rectangle' && (
        <div className="rounded-lg flex items-center justify-center" style={{ width: w, height: h, backgroundColor: bg, border: `2px solid ${border}` }}></div>
      )}
      {data.shapeType === 'circle' && (
        <div className="rounded-full flex items-center justify-center" style={{ width: w, height: h, backgroundColor: bg, border: `2px solid ${border}` }}></div>
      )}
      {data.shapeType === 'ellipse' && (
        <div className="rounded-[50%] flex items-center justify-center" style={{ width: w, height: h, backgroundColor: bg, border: `2px solid ${border}` }}></div>
      )}
      {data.shapeType === 'triangle' && (
         <div className="w-0 h-0 border-l-[80px] border-r-[80px] border-b-[140px] border-l-transparent border-r-transparent filter drop-shadow-sm"
         style={{ borderBottomColor: bg }}></div>
      )}
      {data.shapeType === 'diamond' && (
         <div
           className="filter drop-shadow-sm"
           style={{
             width: w,
             height: h,
             background: bg,
             border: `2px solid ${border}`,
             transform: 'rotate(45deg)',
             borderRadius: 6,
             marginLeft: -w / 4,
             marginTop: -h / 4,
           }}
         ></div>
      )}
      {data.shapeType === 'hexagon' && (
         <svg width={w} height={h} style={{ overflow: 'visible' }}>
           <polygon
             points={[0, 0.5, 1, 1.5, 2, 2.5].map(i => {
               const a = (Math.PI / 3) * (i + 0.5);
               return `${w / 2 + (w * 0.55) * Math.cos(a)},${h / 2 + (h * 0.55) * Math.sin(a)}`;
             }).join(' ')}
             fill={bg}
             stroke={border}
             strokeWidth={2}
           />
         </svg>
      )}
      {!data.shapeType && (
        <div className="rounded-lg flex items-center justify-center" style={{ width: w, height: h, backgroundColor: bg, border: `2px solid ${border}` }}></div>
      )}
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
});

export const CodeNode = memo(({ data, selected }: NodeProps<ElementData>) => {
  return (
    <div className="relative group">
        <Handle type="target" position={Position.Left} className="opacity-0" />
        <DeleteHandle id={data.id} onDelete={(window as any).deleteNode} />
        <div className={`w-[500px] bg-[#282c34] rounded-xl shadow-2xl overflow-hidden border border-gray-600 ${selected ? 'ring-4 ring-indigo-400' : ''}`}>
            <div className="flex items-center px-4 py-3 bg-[#21252b] border-b border-black/20">
                <div className="flex space-x-2">
                    <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
                </div>
                <div className="ml-auto text-xs text-gray-400 font-mono font-bold uppercase">{data.language || 'CODE'}</div>
            </div>
            <div className="p-5 overflow-x-auto text-left" dir="ltr">
                <pre className="text-sm font-mono text-[#abb2bf] whitespace-pre-wrap leading-relaxed">{data.code}</pre>
            </div>
        </div>
        <Handle type="source" position={Position.Right} className="opacity-0" />
    </div>
  );
});

export const ComparisonNode = memo(({ data, selected }: NodeProps<ElementData>) => {
  const fontClass = getFontClass(data.title || "");
  const numColumns = data.columns?.length || 1;

  return (
    <div className="relative group">
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <DeleteHandle id={data.id} onDelete={(window as any).deleteNode} />
      <div className={`bg-white shadow-xl rounded-2xl border border-gray-200 overflow-hidden w-auto min-w-[36rem] max-w-[56rem] transition-all duration-300
        ${selected ? 'ring-4 ring-indigo-300 shadow-2xl' : 'hover:shadow-2xl'}`}>
        
        {data.title && (
          <div className={`bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-2xl text-center py-4 ${fontClass}`}>
            {data.title}
          </div>
        )}
        <div className="flex divide-x divide-gray-100">
          {data.columns?.map((col, colIdx) => (
            <div key={colIdx} className="flex-1 flex flex-col" style={{ flexBasis: `${100 / numColumns}%` }}>
              <div className={`font-bold text-lg p-4 bg-gray-50 text-center text-gray-700 border-b border-gray-100 ${fontClass}`}>
                {col.title}
              </div>
              <ul className="p-5 space-y-3 bg-white h-full list-content">
                <style>{`
                        .list-content b, .list-content strong {
                            font-weight: 800;
                            color: #1a202c;
                        }
                `}</style>
                {col.items?.map((item, itemIdx) => (
                  <li key={itemIdx} className={`text-base text-gray-600 flex items-start gap-3 ${fontClass}`} dir="auto">
                     <i className={`fa-solid ${colIdx === 0 ? 'fa-check text-green-500' : 'fa-star text-orange-400'} mt-1 text-sm`}></i>
                    <span className="leading-snug" dangerouslySetInnerHTML={{__html: item}}></span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
});


// --- Sketch Node (For Drawings) ---
export const SketchNode = memo(({ data, selected }: NodeProps<ElementData>) => {
    return (
        <div className="relative group" style={{ width: data.width, height: data.height, pointerEvents: 'none' }}>
             {selected && (
                 <div className="absolute -top-4 -right-4 pointer-events-auto">
                     <DeleteHandle id={data.id} onDelete={(window as any).deleteNode} />
                 </div>
             )}
             <svg 
                width={data.width} 
                height={data.height} 
                viewBox={`0 0 ${data.width} ${data.height}`}
                style={{ overflow: 'visible', pointerEvents: 'auto' }}
                className={selected ? 'drop-shadow-[0_0_5px_rgba(99,102,241,0.5)]' : ''}
             >
                 <path 
                    d={data.svgPath} 
                    fill={data.isFilled ? (data.strokeColor || '#000') : "none"}
                    stroke="none"
                    opacity={data.isHighlighter ? 0.4 : 1}
                 />
             </svg>
        </div>
    )
});
// ---------------------------------------------------------------
// New education-focused renderers (AI board operator support)
// ---------------------------------------------------------------

export const StickyNode = memo(({ id, data, selected }: NodeProps<ElementData>) => {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(data.content || '');
  const fontClass = getFontClass(content);
  const rotation = data.rotation || (Math.random() - 0.5) * 2;

  useEffect(() => { setContent(data.content || ''); }, [data.content]);

  const handleDoubleClick = () => {
    if ((window as any).isPointerTool?.()) setIsEditing(true);
  };
  const handleBlur = () => {
    setIsEditing(false);
    if ((window as any).updateNodeData) (window as any).updateNodeData(id, { content });
  };
  const handleInput = (e: React.FormEvent<HTMLParagraphElement>) => setContent(e.currentTarget.textContent || '');

  return (
    <div className="relative group" onDoubleClick={handleDoubleClick}>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <DeleteHandle id={data.id} onDelete={(window as any).deleteNode} />
      <div
        className={`p-5 w-64 min-h-[120px] flex flex-col items-center justify-center text-center relative transition-all duration-300
          ${selected ? 'ring-4 ring-indigo-300 shadow-2xl scale-105' : 'shadow-lg hover:shadow-xl hover:-translate-y-1'}`}
        style={{ backgroundColor: data.color || '#FEF3C7', transform: `rotate(${rotation}deg)`, borderRadius: '12px 4px 12px 4px' }}
      >
        <p
          contentEditable={isEditing}
          suppressContentEditableWarning
          onInput={handleInput}
          onBlur={handleBlur}
          className={`text-xl font-medium break-words w-full text-gray-800 ${fontClass} outline-none ${isEditing ? 'cursor-text' : 'cursor-pointer'}`}
          dir="auto"
          dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br />') }}
        />
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
});

export const TableNode = memo(({ data, selected }: NodeProps<ElementData>) => {
  const fontClass = getFontClass(data.title || '');
  const rows: string[][] = Array.isArray(data.rows) && data.rows.length
    ? data.rows as unknown as string[][]
    : (data.columns?.[0]?.items || []).map(i => [i]);

  const header = data.title ? (
    <div className={`px-4 py-2 font-bold text-base text-gray-800 bg-gray-100 border-b border-gray-200 ${fontClass}`}>{data.title}</div>
  ) : null;

  return (
    <div className="relative group">
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <DeleteHandle id={data.id} onDelete={(window as any).deleteNode} />
      <div className={`bg-white shadow-xl rounded-xl border border-gray-200 overflow-hidden min-w-[22rem] max-w-[44rem] transition-all ${selected ? 'ring-4 ring-indigo-300' : 'hover:shadow-2xl'}`}>
        {header}
        <table className="w-full border-collapse text-sm">
          <tbody>
            {rows.slice(0, 12).map((row, ri) => (
              <tr key={ri} className={ri % 2 ? 'bg-gray-50' : 'bg-white'}>
                {row.slice(0, 6).map((cell, ci) => (
                  <td key={ci} className={`px-3 py-2 border border-gray-100 text-gray-700 max-w-[14rem] ${getFontClass(cell)}`} dir="auto"
                    dangerouslySetInnerHTML={{ __html: cell || '\u00A0' }} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
});

export const EquationNode = memo(({ data, selected }: NodeProps<ElementData>) => {
  const fontClass = getFontClass(data.latex || data.text || '');
  const eq = data.latex || data.text || '';
  // Very compact rendering: show the raw LaTeX-like string clearly, no MathJax dependency.
  const display = eq.replace(/\\(frac|sqrt|alpha|beta|gamma|leq|geq|rightarrow)/g, ' $1 ')
    .replace(/[{}\\]/g, ' ');
  return (
    <div className="relative group">
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <DeleteHandle id={data.id} onDelete={(window as any).deleteNode} />
      <div className={`px-5 py-4 bg-white rounded-xl shadow-xl border-2 border-indigo-200 min-w-[12rem] text-center transition-all ${selected ? 'ring-4 ring-indigo-300' : 'hover:shadow-2xl'}`} dir="auto">
        <div className={`text-xl font-semibold text-indigo-800 ${fontClass}`} dangerouslySetInnerHTML={{ __html: display }} />
        {data.title && <div className="mt-1 text-xs text-gray-400">{data.title}</div>}
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
});

export const ArrowNode = memo(({ data, selected }: NodeProps<ElementData>) => {
  const color = data.color || '#6c5ce7';
  const from = data.points?.[0] || { x: 0, y: 0 };
  const to = data.points?.[1] || { x: 120, y: 0 };
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
  const angle = Math.atan2(dy, dx);
  const arrowSize = 12;
  const ax = from.x + dx - arrowSize * Math.cos(angle);
  const ay = from.y + dy - arrowSize * Math.sin(angle);
  const p1 = { x: ax - arrowSize * Math.cos(angle - 0.5), y: ay - arrowSize * Math.sin(angle - 0.5) };
  const p2 = { x: ax - arrowSize * Math.cos(angle + 0.5), y: ay - arrowSize * Math.sin(angle + 0.5) };
  return (
    <div className="relative group" style={{ width: Math.abs(dx) + 20, height: Math.abs(dy) + 20, pointerEvents: 'none' }}>
      <DeleteHandle id={data.id} onDelete={(window as any).deleteNode} />
      <svg width={Math.abs(dx) + 20} height={Math.abs(dy) + 20} style={{ overflow: 'visible', pointerEvents: 'auto', position: 'absolute', top: 0, left: 0 }}>
        <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={color} strokeWidth={(data.strokeWidth) || 3} />
        <line x1={to.x} y1={to.y} x2={p1.x} y2={p1.y} stroke={color} strokeWidth={2.5} />
        <line x1={to.x} y1={to.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth={2.5} />
        {data.label && (
          <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 6} textAnchor="middle" fontSize="13" fill="#333" className={`${getFontClass(data.label)} select-none`}>{data.label}</text>
        )}
      </svg>
    </div>
  );
});

export const LineNode = memo(({ data, selected }: NodeProps<ElementData>) => {
  const color = data.color || '#555';
  const x1 = (data as any).x1 ?? 0;
  const y1 = (data as any).y1 ?? 0;
  const x2 = (data as any).x2 ?? 120;
  const y2 = (data as any).y2 ?? 0;
  return (
    <div className="relative group" style={{ pointerEvents: 'none' }}>
      <DeleteHandle id={data.id} onDelete={(window as any).deleteNode} />
      <svg width={Math.abs(x2 - x1) + 2} height={Math.abs(y2 - y1) + 2} style={{ overflow: 'visible', pointerEvents: 'auto' }}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={2} strokeDasharray={data.style === 'highlight' ? '6 4' : undefined} />
      </svg>
    </div>
  );
});

export const DiagramNode = memo(({ data, selected }: NodeProps<ElementData>) => {
  const fontClass = getFontClass(data.title || '');
  const items = data.graphNodes || data.items || [];
  const nodes = (items as any[]).map((n, i) => ({
    label: n?.label || `Node ${i + 1}`,
    color: n?.color,
    x: (i + 1) * 140 - 60 - 50,
    y: 60,
    w: 100,
    h: 60,
  }));
  return (
    <div className="relative group">
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <DeleteHandle id={data.id} onDelete={(window as any).deleteNode} />
      <div className={`bg-white shadow-xl rounded-xl border border-gray-200 p-4 min-w-[18rem] ${selected ? 'ring-4 ring-indigo-300' : 'hover:shadow-2xl'}`}>
        {data.title && <div className={`font-bold text-lg text-gray-800 mb-3 text-center ${fontClass}`}>{data.title}</div>}
        {(data.graphEdges || []).map((e: any, i: number) => {
          const s = nodes[parseInt(String(e.from), 10) - 1];
          const t = nodes[parseInt(String(e.to), 10) - 1];
          if (!s || !t) return null;
          return <svg key={`e${i}`} className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
            <line x1={s.x + s.w / 2} y1={s.y + s.h} x2={t.x + t.w / 2} y2={t.y} stroke="#94a3b8" strokeWidth={2} />
            {e?.label && <text x={(s.x + t.x) / 2} y={t.y - 8} textAnchor="middle" fontSize="11" fill="#64748b">{e.label}</text>}
          </svg>;
        })}
        <div className="flex flex-wrap justify-center gap-4">
          {nodes.map((n, i) => (
            <div key={i} className={`px-4 py-2 rounded-lg text-sm font-medium border text-center ${getFontClass(n.label)}`}
              style={{ backgroundColor: n.color || '#ede7f6', borderColor: n.color || '#c9bdf0', color: '#4a3f9e', minWidth: 90 }}>
              {n.label}
            </div>
          ))}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
});

export const FlowchartNode = memo(({ data, selected }: NodeProps<ElementData>) => {
  const fontClass = getFontClass(data.title || '');
  const flowNodes = (data.graphNodes || []).map((n: any, i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    return { ...n, x: 60 + col * 180, y: 50 + row * 110, w: 160, h: 70 };
  });
  return (
    <div className="relative group">
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <DeleteHandle id={data.id} onDelete={(window as any).deleteNode} />
      <div className={`bg-white shadow-xl rounded-xl border border-gray-200 p-4 min-w-[22rem] ${selected ? 'ring-4 ring-indigo-300' : 'hover:shadow-2xl'}`}>
        {data.title && <div className={`font-bold text-lg text-gray-800 mb-3 text-center ${fontClass}`}>{data.title}</div>}
        <svg className="w-full" style={{ height: Math.max(110, Math.ceil(flowNodes.length / 3) * 110 + 20) }}>
          {(data.graphEdges || []).map((e: any, i) => {
            const s = flowNodes[parseInt(String(e.from), 10) - 1];
            const t = flowNodes[parseInt(String(e.to), 10) - 1];
            if (!s || !t || !flowNodes.length) return null;
            const sx = s.x + s.w / 2, sy = s.y + s.h;
            const tx = t.x + t.w / 2, ty = t.y;
            return <g key={`fe${i}`}>
              <line x1={sx} y1={sy} x2={tx} y2={ty} stroke="#64748b" strokeWidth={2} markerEnd="url(#fc-arrow)" />
              {e?.label && <text x={(sx + tx) / 2} y={(sy + ty) / 2 - 6} textAnchor="middle" fontSize="11" fill="#475569">{e.label}</text>}
            </g>;
          })}
          <defs>
            <marker id="fc-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
            </marker>
          </defs>
          {flowNodes.map((n: any, i) => (
            <g key={`fn${i}`}>
              <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="10" fill={n.color || '#ede7f6'} stroke={n.color || '#c9bdf0'} strokeWidth="1.5" />
              <text x={n.x + n.w / 2} y={n.y + n.h / 2} textAnchor="middle" dominantBaseline="middle" fontSize="13" fill="#3a3366" className={getFontClass(n.label)}>{n.label}</text>
            </g>
          ))}
        </svg>
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
});

export const TimelineNode = memo(({ data, selected }: NodeProps<ElementData>) => {
  const fontClass = getFontClass(data.title || '');
  const events = data.graphNodes || (data as any).events || [];
  return (
    <div className="relative group">
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <DeleteHandle id={data.id} onDelete={(window as any).deleteNode} />
      <div className={`bg-white shadow-xl rounded-xl border border-gray-200 p-5 min-w-[26rem] ${selected ? 'ring-4 ring-indigo-300' : 'hover:shadow-2xl'}`}>
        {data.title && <div className={`font-bold text-lg text-gray-800 mb-4 text-center ${fontClass}`}>{data.title}</div>}
        <div className="relative pl-6 border-l-2 border-indigo-200 space-y-4" dir="ltr">
          {(events as any[]).map((ev, i) => (
            <div key={i} className="relative">
              <span className="absolute left-[-9px] top-1 w-4 h-4 rounded-full bg-indigo-500 border-2 border-white shadow"></span>
              <div className="text-sm">
                {ev?.date && <span className="inline-block bg-indigo-50 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full mb-1">{ev.date}</span>}
                <div className={`font-semibold text-gray-800 ${getFontClass(String(ev?.label || ''))}`}>{ev?.label}</div>
                {ev?.description && <div className="text-gray-500 text-sm" dir="auto">{ev.description}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
});

// --- Atlas map node ---
const REGION_FILL: Record<string, string> = {
  'n-america': '#ffe082',
  's-america': '#ffe082',
  africa: '#c8e6c9',
  europe: '#c8e6c9',
  asia: '#ffccbc',
  oceania: '#ffccbc',
  'middle-east': '#ffe0b2',
};

export const AtlasNode = memo(({ data, selected }: NodeProps<ElementData>) => {
  const fontClass = getFontClass(data.title || '');
  const region = data.regionId;
  const [localStrokes, setLocalStrokes] = useState<Map<string, string[][]>>(new Map());
  const drawingRef = useRef<string[][]>([]);
  const drawingActive = useRef(false);

  const commitStrokes = () => {
    const current = drawingRef.current;
    if (!current.length) return;
    const merged = [...(data.sketches || []), ...current.map(pts => ({ color: '#e53935', width: 4, points: pts }))];
    drawingRef.current = [];
    setLocalStrokes(new Map());
    (window as any).updateNodeData?.(data.id, { sketches: merged });
  };

  const onMapPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if ((window as any).isPointerTool?.()) return;
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    drawingActive.current = true;
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const p = pt.matrixTransform(ctm.inverse());
    drawingRef.current = [[`${p.x},${p.y}`]];
    setLocalStrokes(new Map(drawingRef.current.map((pts, i) => [String(i), [pts]])));
    svg.setPointerCapture?.(e.pointerId);
  };

  const onMapPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drawingActive.current) return;
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const p = pt.matrixTransform(ctm.inverse());
    const idx = drawingRef.current.length - 1;
    if (idx < 0) return;
    drawingRef.current[idx].push(`${p.x},${p.y}`);
    setLocalStrokes(new Map(drawingRef.current.map((pts, i) => [String(i), [pts]])));
  };

  const onMapPointerUp = () => {
    if (!drawingActive.current) return;
    drawingActive.current = false;
    commitStrokes();
  };

  const enabled = (Array.isArray(data.sketches) ? data.sketches : []);
  const strokes = enabled.map(s => s.points.map(pt => `${pt.x},${pt.y}`)).concat(Array.from(localStrokes.values()).map(g => g[0]));

  return (
    <div className="relative group">
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <DeleteHandle id={data.id} onDelete={(window as any).deleteNode} />
      <div className={`bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden ${
        selected ? 'ring-4 ring-indigo-300' : 'hover:shadow-2xl'
      }`}>
        {data.title && (
          <div className={`px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-lg text-center relative ${fontClass}`}>
            {data.title}
            {selected && enabled.length > 0 && (
              <button
                className="absolute top-1.5 start-2 bg-white/90 hover:bg-white text-[11px] px-2 py-0.5 rounded shadow text-red-600 font-medium z-20 pointer-events-auto"
                onClick={(e) => {
                  e.stopPropagation();
                  (window as any).updateNodeData?.(data.id, { sketches: [] });
                }}
                title="Clear map annotations"
              >
                Clear map drawing
              </button>
            )}
          </div>
        )}
        <svg
          viewBox="0 0 1000 500"
          className="w-[560px] max-w-full h-auto"
          style={{ background: '#eaf3ff', touchAction: 'none', cursor: (window as any).isPointerTool?.() ? 'grab' : 'crosshair' }}
          onPointerDown={onMapPointerDown}
          onPointerMove={onMapPointerMove}
          onPointerUp={onMapPointerUp}
          onPointerLeave={onMapPointerUp}
        >
          {region === 'egypt' ? (
            <>
              <polygon
                points={EGYPT.points.map(p => `${Math.round(p[0]*1.4)},${Math.round(p[1]*1.5)}`).join(' ')}
                fill="#c8e6c9"
                stroke="#2e7d32"
                strokeWidth="3"
              />
              {Object.entries(EGYPT.governorates).map(([k, g]) => (
                <g key={k}>
                  <circle cx={Math.round(g.x*1.4)} cy={Math.round(g.y*1.5)} r="5" fill="#1e88e5">
                    <title>{g.nameAr} / {g.nameEn}</title>
                  </circle>
                  <text x={Math.round(g.x*1.4) + 8} y={Math.round(g.y*1.5) + 4} fontSize="13" fill="#0d47a1" className={getFontClass(g.nameAr)}>
                    {g.nameAr}
                  </text>
                </g>
              ))}
            </>
          ) : region === 'world' || !region ? (
            <>
              {WORLD.map((r) => (
                <polygon
                  key={r.id}
                  points={r.points}
                  fill={region === 'world' ? REGION_FILL[r.id] : '#dfe7f0'}
                  stroke="#607d8b"
                  strokeWidth={region === 'world' ? 2 : 1.2}
                  opacity={region === 'world' ? 0.95 : 0.8}
                >
                  <title>{r.nameAr} / {r.nameEn}</title>
                </polygon>
              ))}
              {WORLD_PINS.map((p) => (
                <g key={p.id}>
                  <circle cx={p.x} cy={p.y} r="4" fill="#ef5350" stroke="#fff" strokeWidth="1.5">
                    <title>{p.nameAr}</title>
                  </circle>
                </g>
              ))}
            </>
          ) : (
            <>
              {WORLD.filter((r) => r.id === region).map((r) => (
                <polygon key={r.id} points={r.points} fill={REGION_FILL[r.id] || '#ffe082'} stroke="#e65100" strokeWidth="3" opacity="0.9">
                  <title>{r.nameAr}</title>
                </polygon>
              ))}
              {WORLD_PINS.filter((p) => p.id === region).map((p) => (
                <g key={p.id}>
                  <circle cx={p.x} cy={p.y} r="5" fill="#ef5350" stroke="#fff" strokeWidth="1.5" />
                </g>
              ))}
            </>
          )}
          {/* Teacher / AI annotations drawn over the map */}
          {strokes.map((pts, i) => (
            <polyline
              key={'d' + i}
              points={pts.join(' ')}
              fill="none"
              stroke={data.sketches?.[i]?.color || '#e53935'}
              strokeWidth={data.sketches?.[i]?.width || 4}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.95}
            />
          ))}
        </svg>
        {data.description && (
          <div className={`px-4 py-2 text-sm text-gray-600 border-t border-gray-100 ${getFontClass(data.description)}`}>{data.description}</div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
});

// --- Periodic element node ---
export const PeriodicNode = memo(({ data, selected }: NodeProps<ElementData>) => {
  const el = data.elementNumber ? ELEMENT_BY_NUMBER[data.elementNumber] : undefined;
  const fontClass = getFontClass(data.title || '');
  if (!el) {
    return (
      <div className="relative group">
        <DeleteHandle id={data.id} onDelete={(window as any).deleteNode} />
        <div className={`bg-white rounded-2xl shadow-xl border border-gray-200 px-6 py-4 ${selected ? 'ring-4 ring-indigo-300' : ''}`}>
          {data.title || 'Element'}
        </div>
      </div>
    );
  }
  return (
    <div className="relative group">
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <DeleteHandle id={data.id} onDelete={(window as any).deleteNode} />
      <div className={`bg-white rounded-2xl shadow-xl border overflow-hidden ${selected ? 'ring-4 ring-indigo-300' : 'hover:shadow-2xl'}`} style={{ borderColor: CATEGORY_COLOR[el.cat] }}>
        <div className="w-56 px-5 py-4 text-white" style={{ backgroundColor: CATEGORY_COLOR[el.cat] }}>
          <div className="text-[11px] opacity-90">{el.n}</div>
          <div className="text-4xl font-bold leading-none mt-1" dir="ltr">{el.sym}</div>
          <div className={`text-base font-medium mt-1 ${fontClass}`}>{el.ar}</div>
        </div>
        <div className="px-5 py-3 space-y-1 text-sm text-gray-700">
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">{data.language?.toLowerCase().startsWith('ar') ? 'الكتلة' : 'Mass'}</span>
            <span className="font-semibold" dir="ltr">{el.mass} u</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">{data.language?.toLowerCase().startsWith('ar') ? 'المجموعة' : 'Group'}</span>
            <span className="font-semibold">{data.language?.toLowerCase().startsWith('ar') ? el.ar : el.name}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">{data.language?.toLowerCase().startsWith('ar') ? 'الدورة' : 'Period'}</span>
            <span className="font-semibold" dir="ltr">{el.n}</span>
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
});
