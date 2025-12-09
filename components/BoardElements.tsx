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
        <div className="absolute -top-6 right-0 opacity-0 hover:opacity-100 transition-opacity group-hover:opacity-100 z-50 pointer-events-auto">
            <button 
                className="bg-red-500 text-white w-6 h-6 rounded-full shadow-md hover:bg-red-600 transition-colors flex items-center justify-center"
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete(id);
                }}
                onPointerDown={(e) => e.stopPropagation()} 
            >
                <i className="fa-solid fa-trash-can text-[10px]"></i>
            </button>
        </div>
    );
};

export const NoteNode = memo(({ id, data, selected }: NodeProps<ElementData>) => {
    const [isEditing, setIsEditing] = useState(false);
    const [content, setContent] = useState(data.content || '');
    const fontClass = getFontClass(content);
    const rotation = data.rotation || (Math.random() - 0.5) * 4;

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
                className={`p-6 w-56 min-h-[140px] shadow-lg flex flex-col justify-center items-center text-center relative transition-all duration-200 overflow-hidden ${selected ? 'ring-2 ring-offset-2 ring-indigo-500 shadow-2xl' : ''}`}
                style={{ backgroundColor: data.color || '#fff740', transform: `rotate(${rotation}deg)`, boxShadow: '3px 5px 15px rgba(0,0,0,0.15)', borderRadius: '4px' }}
            >
                <div className="absolute top-0 right-0 w-8 h-8 bg-black/10" style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }}></div>
                <p 
                    contentEditable={isEditing}
                    suppressContentEditableWarning
                    onInput={handleInput}
                    onBlur={handleBlur}
                    className={`text-xl break-words w-full text-gray-800 ${fontClass} outline-none ${isEditing ? 'ring-2 ring-indigo-400 rounded p-1 bg-white/50 cursor-text' : 'cursor-pointer'}`}
                    dir="auto"
                    // Use dangerouslySetInnerHTML to ensure React updates the content
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
        className={`p-5 pl-10 w-64 bg-white shadow-xl rounded-lg border border-gray-200 transition-all relative
            ${selected ? 'ring-2 ring-offset-2 ring-indigo-500' : ''}`}
        style={{ 
            backgroundColor: data.color || '#ffffff',
        }}
      >
        {/* Legal pad red line */}
        <div className="absolute top-0 left-6 w-0.5 h-full bg-red-400/70"></div>
        {data.title && <div className={`font-bold text-2xl text-center mb-4 text-gray-800 ${fontClass}`}>{data.title}</div>}
        <ul className="space-y-2 list-disc list-inside">
          {data.items?.map((item, idx) => (
            <li key={idx} className={`text-lg text-gray-700 ${fontClass}`} dir="auto">
              {item}
            </li>
          ))}
        </ul>
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
      <div className={`p-3 bg-white shadow-xl rounded-sm border border-gray-200 ${selected ? 'ring-2 ring-indigo-500' : ''}`}>
        <div className="w-64 h-64 bg-gray-100 overflow-hidden relative flex items-center justify-center">
           {data.url && !error ? (
             <>
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
                        <i className="fa-solid fa-spinner fa-spin text-3xl text-indigo-400"></i>
                    </div>
                )}
                <img 
                    src={data.url} 
                    alt={data.description}
                    className={`w-full h-full object-cover pointer-events-none transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}
                    loading="lazy"
                    onLoad={() => setLoading(false)}
                    onError={() => { setLoading(false); setError(true); }}
                />
             </>
           ) : (
             <div className="text-gray-400 flex flex-col items-center">
                <i className="fa-regular fa-image text-4xl mb-2"></i>
                <span className="text-xs text-center px-2">{error ? "Failed to load image" : "No Image"}</span>
             </div>
           )}
        </div>
        {/* Description is hidden as requested */}
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
                className={`text-6xl font-bold select-none whitespace-nowrap outline-none ${fontClass} ${selected ? 'drop-shadow-2xl' : ''} ${isEditing ? 'ring-2 ring-indigo-400 rounded px-2 cursor-text' : 'cursor-pointer'}`}
                style={{ color: data.color || '#e17055', textShadow: '3px 3px 0px rgba(0,0,0,0.1)' }}
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
        <div className="relative group" onDoubleClick={handleDoubleClick} style={{ width: data.width || 250, height: data.height || 'auto' }}>
            <NodeResizer minWidth={100} minHeight={40} isVisible={selected} handleClassName="bg-indigo-500 w-2 h-2 rounded-full border-2 border-white shadow-lg" />
            <Handle type="target" position={Position.Top} className="opacity-0" />
            <DeleteHandle id={data.id} onDelete={(window as any).deleteNode} />
            <div
                contentEditable={isEditing}
                suppressContentEditableWarning
                onInput={handleInput}
                onBlur={handleBlur}
                className={`p-2 text-xl break-words w-full h-full outline-none focus:ring-2 focus:ring-indigo-400 rounded-md transition-shadow text-gray-800 ${fontClass} ${isEditing ? 'cursor-text' : 'cursor-pointer'}`}
                style={{ minHeight: '40px' }}
                dir="auto"
            >
                {text}
            </div>
            <Handle type="source" position={Position.Bottom} className="opacity-0" />
        </div>
    );
});

export const ShapeNode = memo(({ data, selected }: NodeProps<ElementData>) => {
  const bg = data.color || '#a8e6cf';
  
  return (
    <div className="relative group">
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <DeleteHandle id={data.id} onDelete={(window as any).deleteNode} />
      <div className={`${selected ? 'ring-2 ring-indigo-500 ring-offset-4' : ''}`}>
      {data.shapeType === 'rectangle' && (
        <div className="w-40 h-28 shadow-md border-2 border-gray-800 rounded-lg flex items-center justify-center" style={{ backgroundColor: bg }}></div>
      )}
      {data.shapeType === 'circle' && (
        <div className="w-32 h-32 shadow-md border-2 border-gray-800 rounded-full" style={{ backgroundColor: bg }}></div>
      )}
      {data.shapeType === 'triangle' && (
         <div className="w-0 h-0 border-l-[60px] border-r-[60px] border-b-[100px] border-l-transparent border-r-transparent filter drop-shadow-md"
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
        <div className={`w-96 bg-[#1e1e1e] rounded-lg shadow-2xl overflow-hidden border border-gray-700 ${selected ? 'ring-2 ring-indigo-500' : ''}`}>
            <div className="flex items-center px-4 py-2 bg-[#252526] border-b border-gray-700">
                <div className="flex space-x-2">
                    <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
                </div>
                <div className="ml-auto text-xs text-gray-400 font-mono">{data.language}</div>
            </div>
            <div className="p-4 overflow-x-auto text-left" dir="ltr">
                <pre className="text-sm font-mono text-[#d4d4d4] whitespace-pre-wrap">{data.code}</pre>
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
      <div className={`bg-white shadow-xl rounded-lg border border-gray-200 transition-all w-auto min-w-[30rem] max-w-[50rem] ${selected ? 'ring-2 ring-offset-2 ring-indigo-500' : ''}`}>
        {data.title && (
          <div className={`font-bold text-2xl text-center p-4 text-gray-800 border-b-2 border-gray-100 ${fontClass}`}>
            {data.title}
          </div>
        )}
        <div className="flex divide-x divide-gray-100">
          {data.columns?.map((col, colIdx) => (
            <div key={colIdx} className="flex-1 flex flex-col" style={{ flexBasis: `${100 / numColumns}%` }}>
              <div className={`font-bold text-lg p-3 bg-gray-50 text-center text-gray-700 ${fontClass}`}>
                {col.title}
              </div>
              <ul className="p-4 space-y-3">
                {col.items?.map((item, itemIdx) => (
                  <li key={itemIdx} className={`text-base text-gray-600 flex items-start gap-3 ${fontClass}`} dir="auto">
                    <i className="fa-solid fa-check text-green-500 mt-1"></i>
                    <span>{item}</span>
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
                className={selected ? 'drop-shadow-[0_0_2px_blue]' : ''}
             >
                 <path 
                    d={data.svgPath} 
                    fill={data.isFilled ? (data.strokeColor || '#000') : "none"}
                    stroke="none"
                    opacity={data.isHighlighter ? 0.5 : 1}
                 />
             </svg>
        </div>
    )
});