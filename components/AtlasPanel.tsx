import React, { useState } from 'react';
import { Sheet } from './ui';
import { ComposableMap, Geographies, Geography, Graticule, Sphere, ZoomableGroup, Marker } from 'react-simple-maps';
import { EGYPT, ATLAS_PRESETS, WORLD_PINS } from '../data/atlas';

interface AtlasPanelProps {
  open: boolean;
  onClose: () => void;
  language: string;
  onPlace: (regionId: string, title: string, opts?: { pins?: string[]; countries?: string[] }) => void;
}

const GEO_URL = '/world-countries-110m.json';
const PIN_COORDS: Record<string, [number, number]> = {
  us: [-100, 38], brazil: [-52, -10], uk: [-3, 55], france: [2, 46], germany: [10, 51],
  egypt: [30, 27], saudi: [45, 24], japan: [138, 36], china: [105, 35], india: [79, 22],
  australia: [134, -25], russia: [90, 60],
};
const REGION_COUNTRIES: Record<string, string[]> = {
  africa: ['Egypt', 'South Africa', 'Nigeria', 'Kenya', 'Morocco', 'Algeria'],
  'n-america': ['United States of America', 'Canada', 'Mexico'],
  's-america': ['Brazil', 'Argentina', 'Chile', 'Peru', 'Colombia'],
  asia: ['China', 'India', 'Japan', 'Saudi Arabia', 'Türkiye', 'Turkey'],
  europe: ['United Kingdom', 'France', 'Germany', 'Italy', 'Spain', 'Norway'],
  oceania: ['Australia', 'New Zealand'],
  'middle-east': ['Egypt', 'Saudi Arabia', 'Iraq', 'Jordan', 'Israel', 'United Arab Emirates'],
};

const AtlasPanel: React.FC<AtlasPanelProps> = ({ open, onClose, language, onPlace }) => {
  const isAr = language.toLowerCase().startsWith('ar');
  const [region, setRegion] = useState<string>('world');
  const [pins, setPins] = useState<Set<string>>(new Set());
  const [position, setPosition] = useState({ coordinates: [0, 0] as [number, number], zoom: 1 });
  const t = (ar: string, en: string) => (isAr ? ar : en);

  const togglePin = (id: string) => {
    setPins(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const place = () => {
    const preset = ATLAS_PRESETS.find(x => x.id === region);
    onPlace(region, isAr ? preset?.nameAr || region : preset?.nameEn || region, {
      pins: pins.size ? [...pins] : undefined,
      countries: selectedCountries.length ? [...selectedCountries] : undefined,
    });
  };

  const selectedCountries = REGION_COUNTRIES[region] || [];

  return (
    <Sheet open={open} onClose={onClose} title={
      <span className="inline-flex items-center gap-2">
        <span className="material-symbols-rounded text-primary">map</span>
        {t('الأطلس التفاعلي', 'Interactive Atlas')}
      </span>
    } maxW="max-w-5xl">
      <div className="flex flex-wrap gap-2 mb-4">
        {ATLAS_PRESETS.map(p => (
          <button key={p.id} onClick={() => { setRegion(p.id); setPosition({ coordinates: [0, 0], zoom: p.id === 'egypt' ? 3.2 : 1 }); }} className={`mat-btn px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${region === p.id ? 'bg-primary text-white border-primary' : 'bg-surface-variant/40 border-black/10 text-on-surface/70 hover:bg-surface-variant'}`}>
            {isAr ? p.nameAr : p.nameEn}
          </button>
        ))}
      </div>

      <div className="rounded-2xl overflow-hidden border border-slate-900/20 bg-[#082b55] relative shadow-inner">
        <img src="/atlas-hero.png" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover opacity-25 pointer-events-none" />
        {region === 'egypt' ? (
          <svg viewBox="0 0 420 340" className="w-full h-auto relative p-3">
            <rect width="420" height="340" rx="18" fill="rgba(8,43,85,.72)" />
            <text x="24" y="34" fill="white" opacity=".9" fontSize="20" fontWeight="700">{t('مصر — المحافظات الرئيسية', 'Egypt — key governorates')}</text>
            <polygon points={EGYPT.points.map(p => `${Math.round(p[0] * 1.45 + 60)},${Math.round(p[1] * 1.45 + 45)}`).join(' ')} fill="#f7c948" stroke="#fff" strokeWidth="3" />
            {Object.entries(EGYPT.governorates).map(([key, governorate]) => (
              <g key={key} className="cursor-pointer" onClick={() => togglePin(key)}>
                <title>{governorate.nameAr} / {governorate.nameEn}</title>
                <circle cx={Math.round(governorate.x * 1.45 + 60)} cy={Math.round(governorate.y * 1.45 + 45)} r={pins.has(key) ? 9 : 6} fill={pins.has(key) ? '#ef5350' : '#13b7d6'} stroke="#fff" strokeWidth="2" />
                <text x={Math.round(governorate.x * 1.45 + 72)} y={Math.round(governorate.y * 1.45 + 49)} fontSize="12" fill="white" fontWeight="600">{isAr ? governorate.nameAr : governorate.nameEn}</text>
              </g>
            ))}
          </svg>
        ) : (
          <ComposableMap projection="geoEqualEarth" projectionConfig={{ scale: 150 }} className="w-full h-auto relative">
            <ZoomableGroup zoom={position.zoom} center={position.coordinates} onMoveEnd={setPosition} minZoom={1} maxZoom={6}>
              <Graticule stroke="#7ed6df" strokeOpacity={0.18} strokeWidth={0.5} />
              <Sphere stroke="#b9f3ff" strokeWidth={0.7} fill="transparent" />
              <Geographies geography={GEO_URL}>
                {({ geographies, borders }) => (
                  <>
                    {geographies.map(geo => {
                      const name = String(geo.properties?.name || geo.properties?.NAME || '');
                      const selected = !selectedCountries.length || selectedCountries.includes(name);
                      return <Geography key={geo.rsmKey} geography={geo} onClick={() => { const pin = WORLD_PINS.find(p => p.nameEn.toLowerCase() === name.toLowerCase()); if (pin) togglePin(pin.id); }} style={{ default: { fill: selected ? '#2fb7b3' : '#284b73', stroke: '#d8f3f7', strokeWidth: 0.35, outline: 'none', opacity: selected ? 0.95 : 0.45 }, hover: { fill: '#f7c948', outline: 'none', cursor: 'pointer' }, pressed: { fill: '#ef5350', outline: 'none' } }} />;
                    })}
                    <path d={borders?.svgPath || ''} fill="none" stroke="#d8f3f7" strokeWidth={0.35} opacity={0.8} />
                  </>
                )}
              </Geographies>
              {WORLD_PINS.map(pin => {
                const coordinates = PIN_COORDS[pin.id];
                if (!coordinates) return null;
                return <Marker key={pin.id} coordinates={coordinates} onClick={() => togglePin(pin.id)}><circle r={pins.has(pin.id) ? 5 : 3.2} fill={pins.has(pin.id) ? '#ef5350' : '#f7c948'} stroke="#fff" strokeWidth={1.2} /><title>{isAr ? pin.nameAr : pin.nameEn}</title></Marker>;
              })}
            </ZoomableGroup>
          </ComposableMap>
        )}
        <div className="absolute bottom-3 start-3 rounded-full bg-slate-950/70 text-white/80 px-3 py-1 text-[11px]">{t('اسحب للتنقل · استخدم التكبير', 'Drag to pan · scroll to zoom')}</div>
      </div>

      <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
        <p className="text-sm text-on-surface/60">{t('اضغط على الدول أو العلامات لتحديدها، ثم ضع الخريطة على السبورة.', 'Click countries or markers to select them, then place the map on the board.')}</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="mat-btn px-4 py-2 rounded-full border border-black/10 text-on-surface hover:bg-surface-variant/50">{t('إلغاء', 'Cancel')}</button>
          <button onClick={place} className="mat-btn px-5 py-2 rounded-full bg-primary text-white shadow-elev-1 font-medium">{t('ضع على السبورة', 'Place on board')}</button>
        </div>
      </div>
    </Sheet>
  );
};

export default AtlasPanel;
