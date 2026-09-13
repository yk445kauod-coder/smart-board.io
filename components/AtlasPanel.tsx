import React, { useState } from 'react';
import { Sheet } from './ui';
import { WORLD, EGYPT, ATLAS_PRESETS, WORLD_PINS } from '../data/atlas';

interface AtlasPanelProps {
  open: boolean;
  onClose: () => void;
  language: string;
  onPlace: (regionId: string, title: string, opts?: { pins?: string[] }) => void;
}

const REGION_FILL: Record<string, string> = {
  'n-america': '#ffe082',
  's-america': '#ffe082',
  africa: '#c8e6c9',
  europe: '#c8e6c9',
  asia: '#ffccbc',
  oceania: '#ffccbc',
  'middle-east': '#ffe0b2',
};

const AtlasPanel: React.FC<AtlasPanelProps> = ({ open, onClose, language, onPlace }) => {
  const isAr = language.toLowerCase().startsWith('ar');
  const [region, setRegion] = useState<string>('world');
  const [pins, setPins] = useState<Set<string>>(new Set());

  const t = (ar: string, en: string) => (isAr ? ar : en);

  const togglePin = (id: string) => {
    setPins(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const place = () => {
    const p = ATLAS_PRESETS.find(x => x.id === region);
    onPlace(region, isAr ? p?.nameAr || region : p?.nameEn || region, { pins: pins.size ? [...pins] : undefined });
  };

  return (
    <Sheet open={open} onClose={onClose} title={
      <span className="inline-flex items-center gap-2">
        <span className="material-symbols-rounded text-primary">map</span>
        {t('الأطلس التفاعلي', 'Interactive Atlas')}
      </span>
    } maxW="max-w-4xl">
      {/* Region preset chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {ATLAS_PRESETS.map(p => (
          <button
            key={p.id}
            onClick={() => setRegion(p.id)}
            className={`mat-btn px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
              region === p.id ? 'bg-primary text-white border-primary' : 'bg-surface-variant/40 border-black/10 text-on-surface/70 hover:bg-surface-variant'
            }`}
          >
            {isAr ? p.nameAr : p.nameEn}
          </button>
        ))}
      </div>

      {/* Map canvas */}
      <div className="rounded-2xl overflow-hidden border border-black/10 bg-[#eaf3ff]">
        <svg viewBox="0 0 1000 500" className="w-full h-auto">
          {region === 'egypt' ? (
            <>
              <polygon
                points={EGYPT.points.map(p => `${Math.round(p[0]*1.4)},${Math.round(p[1]*1.5)}`).join(' ')}
                fill="#c8e6c9"
                stroke="#2e7d32"
                strokeWidth="3"
                className="cursor-pointer"
                onClick={() => {}}
              />
              {Object.entries(EGYPT.governorates).map(([k, g]) => (
                <g key={k} className="cursor-pointer">
                  <title>{g.nameAr} / {g.nameEn}</title>
                  <circle cx={Math.round(g.x*1.4)} cy={Math.round(g.y*1.5)} r="7" fill="#1e88e5" stroke="#fff" strokeWidth="2" />
                  <text x={Math.round(g.x*1.4) + 12} y={Math.round(g.y*1.5) + 5} fontSize="15" fill="#0d47a1" fontWeight="600">
                    {isAr ? g.nameAr : g.nameEn}
                  </text>
                </g>
              ))}
            </>
          ) : region === 'world' ? (
            <>
              {WORLD.map(r => (
                <polygon
                  key={r.id}
                  points={r.points}
                  fill={REGION_FILL[r.id] || '#dfe7f0'}
                  stroke="#607d8b"
                  strokeWidth="1.5"
                  opacity="0.95"
                >
                  <title>{isAr ? r.nameAr : r.nameEn}</title>
                </polygon>
              ))}
              {WORLD_PINS.map(p => (
                <g
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() => togglePin(p.id)}
                >
                  <title>{isAr ? p.nameAr : p.nameEn}</title>
                  <circle cx={p.x} cy={p.y} r={pins.has(p.id) ? 8 : 5} fill={pins.has(p.id) ? '#d32f2f' : '#ef5350'} stroke="#fff" strokeWidth="2">
                    <animate attributeName="r" values={pins.has(p.id) ? "8;9;8" : "5;5;5"} dur="1.5s" repeatCount="indefinite" />
                  </circle>
                </g>
              ))}
            </>
          ) : (
            <>
              {WORLD.filter(r => r.id === region).map(r => (
                <polygon key={r.id} points={r.points} fill={REGION_FILL[r.id] || '#ffe082'} stroke="#e65100" strokeWidth="3" opacity="0.95" />
              ))}
              {WORLD_PINS.filter(p => p.id === region).map(p => (
                <g key={p.id}>
                  <title>{isAr ? p.nameAr : p.nameEn}</title>
                  <circle cx={p.x} cy={p.y} r="7" fill="#ef5350" stroke="#fff" strokeWidth="2" />
                </g>
              ))}
            </>
          )}
        </svg>
      </div>

      <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
        <p className="text-sm text-on-surface/60">
          {t('اضغط على البلدان لإضافة نقاط تمييز، ثم ضع الخريطة على السبورة.', 'Click countries to pin them, then place the map on the board.')}
        </p>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="mat-btn px-4 py-2 rounded-full border border-black/10 text-on-surface hover:bg-surface-variant/50"
          >
            {t('إلغاء', 'Cancel')}
          </button>
          <button
            onClick={place}
            className="mat-btn px-5 py-2 rounded-full bg-primary text-white shadow-elev-1 font-medium"
          >
            {t('ضع على السبورة', 'Place on board')}
          </button>
        </div>
      </div>
    </Sheet>
  );
};

export default AtlasPanel;