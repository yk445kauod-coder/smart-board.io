import React, { useState } from 'react';

interface GeometryToolsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  language: string;
}

type ActiveTool = 'ruler' | 'protractor' | 'compass';

export const GeometryToolsOverlay: React.FC<GeometryToolsOverlayProps> = ({
  isOpen,
  onClose,
  language,
}) => {
  const isAr = language.toLowerCase().startsWith('ar');
  const [activeTool, setActiveTool] = useState<ActiveTool>('ruler');

  // Ruler state
  const [rulerPos, setRulerPos] = useState({ x: 200, y: 200 });
  const [rulerAngle, setRulerAngle] = useState(0);

  // Protractor state
  const [protPos, setProtPos] = useState({ x: 300, y: 150 });

  // Compass state
  const [compassPos, setCompassPos] = useState({ x: 250, y: 220 });
  const [compassRadius, setCompassRadius] = useState(120);
  const [compassAngle, setCompassAngle] = useState(0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 pointer-events-none flex flex-col justify-between p-4">
      {/* Geometry Control Toolbar */}
      <div className="pointer-events-auto self-center bg-[#080D1E]/90 backdrop-blur border border-white/10 text-white rounded-2xl shadow-xl px-4 py-2 flex items-center gap-3">
        <span className="text-xs font-bold text-[#00E5FF] font-arabic flex items-center gap-1">
          <span className="material-symbols-rounded text-base">straighten</span>
          {isAr ? 'الأدوات الهندسية' : 'Geometry Tools'}
        </span>

        <div className="h-4 w-px bg-white/20" />

        <button
          onClick={() => setActiveTool('ruler')}
          className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 ${
            activeTool === 'ruler' ? 'bg-[#00E5FF] text-black' : 'hover:bg-white/10 text-white/80'
          }`}
        >
          <span className="material-symbols-rounded text-sm">square_foot</span>
          {isAr ? 'المسطرة' : 'Ruler'}
        </button>

        <button
          onClick={() => setActiveTool('protractor')}
          className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 ${
            activeTool === 'protractor' ? 'bg-[#00E5FF] text-[#080D1E]' : 'hover:bg-white/10 text-white/80'
          }`}
        >
          <span className="material-symbols-rounded text-sm">donut_large</span>
          {isAr ? 'المنقلة' : 'Protractor'}
        </button>

        <button
          onClick={() => setActiveTool('compass')}
          className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 ${
            activeTool === 'compass' ? 'bg-[#00E5FF] text-[#080D1E]' : 'hover:bg-white/10 text-white/80'
          }`}
        >
          <span className="material-symbols-rounded text-sm">architecture</span>
          {isAr ? 'الفرجار' : 'Compass'}
        </button>

        <div className="h-4 w-px bg-white/20" />

        <button
          onClick={onClose}
          className="p-1 hover:bg-white/20 rounded-lg text-white/60 hover:text-white transition-all"
          title={isAr ? 'إغلاق الأدوات' : 'Close tools'}
        >
          <span className="material-symbols-rounded text-sm">close</span>
        </button>
      </div>

      {/* Interactive Tool Renderers */}
      <div className="flex-1 relative pointer-events-none my-4">
        {/* 1. Ruler Tool Overlay */}
        {activeTool === 'ruler' && (
          <div
            style={{
              transform: `translate(${rulerPos.x}px, ${rulerPos.y}px) rotate(${rulerAngle}deg)`,
            }}
            className="pointer-events-auto absolute bg-amber-100/90 border-2 border-amber-600/60 rounded-lg shadow-2xl w-[450px] h-[70px] select-none flex flex-col justify-between p-1.5 cursor-move"
            onMouseDown={(e) => {
              const startX = e.clientX - rulerPos.x;
              const startY = e.clientY - rulerPos.y;
              const onMove = (me: MouseEvent) => {
                setRulerPos({ x: me.clientX - startX, y: me.clientY - startY });
              };
              const onUp = () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
              };
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            }}
          >
            {/* Top Ticks */}
            <div className="flex justify-between items-start h-6 border-b border-amber-800/30 px-2 relative">
              {Array.from({ length: 30 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div
                    className={`bg-amber-900 ${i % 5 === 0 ? 'h-4 w-0.5' : 'h-2 w-px opacity-60'}`}
                  />
                  {i % 5 === 0 && (
                    <span className="text-[9px] font-mono font-bold text-amber-950">
                      {i / 2}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Rotation Control handle */}
            <div className="flex justify-between items-center px-3 text-amber-900 text-xs font-semibold">
              <span className="text-[10px] opacity-70">
                {isAr ? 'قياس بالسنتمتر (cm)' : 'Centimeters (cm)'}
              </span>
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold">Z:</label>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  value={rulerAngle}
                  onChange={(e) => setRulerAngle(Number(e.target.value))}
                  className="w-20 accent-amber-700"
                />
                <span className="font-mono text-[10px]">{rulerAngle}°</span>
              </div>
            </div>
          </div>
        )}

        {/* 2. Protractor Tool Overlay */}
        {activeTool === 'protractor' && (
          <div
            style={{ transform: `translate(${protPos.x}px, ${protPos.y}px)` }}
            className="pointer-events-auto absolute bg-sky-200/40 border-2 border-sky-500/80 rounded-t-full shadow-2xl w-[320px] h-[160px] select-none cursor-move flex flex-col justify-end items-center relative overflow-hidden"
            onMouseDown={(e) => {
              const startX = e.clientX - protPos.x;
              const startY = e.clientY - protPos.y;
              const onMove = (me: MouseEvent) => {
                setProtPos({ x: me.clientX - startX, y: me.clientY - startY });
              };
              const onUp = () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
              };
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            }}
          >
            {/* Protractor Arc Ticks */}
            <svg className="absolute inset-0 w-full h-full">
              <path
                d="M 10 150 A 150 150 0 0 1 310 150 Z"
                fill="none"
                stroke="rgba(14, 165, 233, 0.4)"
                strokeWidth="2"
              />
              {Array.from({ length: 19 }).map((_, i) => {
                const angle = (i * 10 * Math.PI) / 180;
                const x1 = 160 - 150 * Math.cos(angle);
                const y1 = 160 - 150 * Math.sin(angle);
                const x2 = 160 - 135 * Math.cos(angle);
                const y2 = 160 - 135 * Math.sin(angle);
                return (
                  <line
                    key={i}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#0369a1"
                    strokeWidth={i % 3 === 0 ? "2" : "1"}
                  />
                );
              })}
            </svg>
            <div className="w-3 h-3 rounded-full border-2 border-sky-700 bg-white mb-1 z-10" />
            <span className="text-[10px] font-bold text-sky-900 mb-2 z-10 font-mono">180°</span>
          </div>
        )}

        {/* 3. Compass Tool Overlay */}
        {activeTool === 'compass' && (
          <div
            style={{ transform: `translate(${compassPos.x}px, ${compassPos.y}px)` }}
            className="pointer-events-auto absolute select-none cursor-move flex flex-col items-center"
            onMouseDown={(e) => {
              const startX = e.clientX - compassPos.x;
              const startY = e.clientY - compassPos.y;
              const onMove = (me: MouseEvent) => {
                setCompassPos({ x: me.clientX - startX, y: me.clientY - startY });
              };
              const onUp = () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
              };
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            }}
          >
            <svg width={compassRadius * 2 + 20} height={compassRadius * 2 + 20} className="overflow-visible">
              <circle
                cx={compassRadius + 10}
                cy={compassRadius + 10}
                r={compassRadius}
                fill="none"
                stroke="#00E5FF"
                strokeWidth="2"
                strokeDasharray="6 4"
              />
              <line
                x1={compassRadius + 10}
                y1={compassRadius + 10}
                x2={compassRadius + 10 + compassRadius * Math.cos((compassAngle * Math.PI) / 180)}
                y2={compassRadius + 10 + compassRadius * Math.sin((compassAngle * Math.PI) / 180)}
                stroke="#F59E0B"
                strokeWidth="3"
              />
            </svg>

            <div className="bg-[#080D1E] border border-white/20 text-white rounded-xl p-2 mt-2 flex items-center gap-2 text-xs">
              <span>{isAr ? 'نصف القطر:' : 'Radius:'}</span>
              <input
                type="range"
                min="40"
                max="200"
                value={compassRadius}
                onChange={(e) => setCompassRadius(Number(e.target.value))}
                className="w-24 accent-[#00E5FF]"
              />
              <span className="font-mono">{compassRadius}px</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GeometryToolsOverlay;
