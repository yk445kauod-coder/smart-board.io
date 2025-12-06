
import React, { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
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

export const NoteNode = memo(({ data, selected }: NodeProps<ElementData>) => {
  const fontClass = getFontClass(data.content || "");
  const rotation = data.rotation || 0;
  
  return (
    <div className="relative group">
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <DeleteHandle id={data.id} onDelete={(window as any).deleteNode} />
      <div 
        className={`p-6 w-56 min-h-[140px] shadow-lg flex flex-col justify-center items-center text-center relative transition-shadow duration-200
          ${data.style === 'bold' ? 'font-bold' : ''}
          ${data.style === 'highlight' ? 'border-4 border-yellow-600/20' : ''}
          ${selected ? 'ring-2 ring-indigo-500 shadow-2xl' : ''}
        `}
        style={{ 
          backgroundColor: data.color || '#fff740',
          transform: `rotate(${rotation}deg)`,
          boxShadow: '2px 4px 12px rgba(0,0,0,0.15)',
          borderRadius: '2px 2px 25px 2px'
        }}
      >
        <div className="absolute top-0 left-0 w-full h-8 bg-black/5 pointer-events-none"></div>
        <p className={`text-xl break-words w-full text-gray-800 ${fontClass}`} dir="auto">
          {data.content}
        </p>
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
        className={`p-5 w-64 bg-white shadow-xl rounded-lg border border-gray-100 transition-all
            ${selected ? 'ring-2 ring-indigo-500' : ''}`}
        style={{ 
            backgroundColor: data.color || '#ffffff',
            backgroundImage: 'linear-gradient(#e5e7eb 1px, transparent 1px)',
            backgroundSize: '100% 2rem',
            lineHeight: '2rem'
        }}
      >
        {data.title && <div className={`font-bold text-xl text-center mb-2 text-indigo-600 ${fontClass}`}>{data.title}</div>}
        <ul className="space-y-0">
          {data.items?.map((item, idx) => (
            <li key={idx} className={`flex items-center gap-3 text-lg text-gray-800 ${fontClass}`} dir="auto">
              <div className="w-4 h-4 border-2 border-gray-400 rounded-sm flex-shrink-0"></div>
              <span>{item}</span>
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
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
});

export const WordArtNode = memo(({ data, selected }: NodeProps<ElementData>) => {
  const fontClass = getFontClass(data.text || "");
  
  return (
    <div className="relative group">
        <Handle type="target" position={Position.Left} className="opacity-0" />
        <DeleteHandle id={data.id} onDelete={(window as any).deleteNode} />
      <h1 
        className={`text-6xl font-bold select-none ${fontClass} ${selected ? 'drop-shadow-2xl' : ''}`}
        style={{ 
          color: data.color || '#e17055',
          textShadow: '3px 3px 0px rgba(0,0,0,0.1)',
        }}
      >
        {data.text}
      </h1>
      <Handle type="source" position={Position.Right} className="opacity-0" />
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
