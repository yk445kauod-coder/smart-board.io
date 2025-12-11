import React, { memo, useState, useEffect } from 'react';
import { Handle, Position, NodeResizer } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { ElementData } from '../types';

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
        <div className="w-72 h-64 bg-gray-50 rounded-lg overflow-hidden relative flex items-center justify-center">
           {data.url && !error ? (
             <>
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
                        <i className="fa-solid fa-spinner fa-spin text-2xl text-indigo-400"></i>
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
                <i className="fa-regular fa-image text-3xl opacity-50"></i>
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
  
  return (
    <div className="relative group">
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <DeleteHandle id={data.id} onDelete={(window as any).deleteNode} />
      <div className={`transition-transform duration-300 ${selected ? 'scale-105 drop-shadow-xl' : 'drop-shadow-md hover:scale-105'}`}>
      {data.shapeType === 'rectangle' && (
        <div className="w-48 h-32 rounded-xl flex items-center justify-center backdrop-blur-sm bg-opacity-90 border-2 border-white/50" style={{ backgroundColor: bg }}></div>
      )}
      {data.shapeType === 'circle' && (
        <div className="w-40 h-40 rounded-full flex items-center justify-center backdrop-blur-sm bg-opacity-90 border-2 border-white/50" style={{ backgroundColor: bg }}></div>
      )}
      {data.shapeType === 'triangle' && (
         <div className="w-0 h-0 border-l-[80px] border-r-[80px] border-b-[140px] border-l-transparent border-r-transparent filter drop-shadow-sm opacity-90"
         style={{ borderBottomColor: bg }}></div>
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