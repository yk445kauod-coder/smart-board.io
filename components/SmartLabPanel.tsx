import React, { useMemo, useState } from 'react';
import { Sheet } from './ui';
import { ELEMENTS, CATEGORY_COLOR, CATEGORY_LABEL, ElementInfo } from '../data/periodic';
import {
  balanceEquation,
  equationToString,
  REACTIVITY_SERIES,
  REACTIVITY_NAMES,
  doesDisplace,
  DISPLACEMENT_EXAMPLES,
  COMPANION_MATERIALS,
  POLYATOMIC_IONS,
} from '../data/chemistry';

interface SmartLabPanelProps {
  open: boolean;
  onClose: () => void;
  language: string;
  onPlaceElement: (el: ElementInfo) => void;
  onPlaceReaction: (title: string, lhs: string[], rhs: string[]) => void;
  onPlaceText: (title: string, items: string[]) => void;
}

type Tab = 'table' | 'balancer' | 'reactions' | 'materials';

const SmartLabPanel: React.FC<SmartLabPanelProps> = ({ open, onClose, language, onPlaceElement, onPlaceReaction, onPlaceText }) => {
  const isAr = language.toLowerCase().startsWith('ar');
  const [tab, setTab] = useState<Tab>('table');
  const [selected, setSelected] = useState<ElementInfo | null>(null);
  // Balancer inputs
  const [lhs, setLhs] = useState('H2 + O2');
  const [rhs, setRhs] = useState('H2O');
  // Displacement
  const [metalA, setMetalA] = useState('Fe');
  const [metalB, setMetalB] = useState('Cu');

  const t = (ar: string, en: string) => (isAr ? ar : en);

  const balanced = useMemo(() => {
    const l = lhs.split('+').map(s => s.trim()).filter(Boolean);
    const r = rhs.split('+').map(s => s.trim()).filter(Boolean);
    if (!l.length || !r.length) return null;
    return balanceEquation(l, r);
  }, [lhs, rhs]);

  const tabs: { id: Tab; ar: string; en: string; icon: string }[] = [
    { id: 'table', ar: 'الجدول الدوري', en: 'Periodic table', icon: 'grid_on' },
    { id: 'balancer', ar: 'موازنة المعادلات', en: 'Balance', icon: 'balance' },
    { id: 'reactions', ar: 'الإزاحة والتفاعلات', en: 'Reactions', icon: 'science' },
    { id: 'materials', ar: 'مرافق دراسية', en: 'Materials', icon: 'menu_book' },
  ];

  const placeReaction = () => {
    if (!balanced) return;
    const l = lhs.split('+').map(s => s.trim()).filter(Boolean);
    const r = rhs.split('+').map(s => s.trim()).filter(Boolean);
    onPlaceReaction(balanced.balanced ? t('الموازنة الناتجة', 'Balanced equation') : t('معادلة غير متوازنة', 'Unbalanced equation'), l, r);
  };

  return (
    <Sheet open={open} onClose={onClose} title={
      <span className="inline-flex items-center gap-2">
        <span className="material-symbols-rounded text-primary">science</span>
        {t('المعمل الذكي — الكيمياء', 'Smart Lab — Chemistry')}
      </span>
    } maxW="max-w-5xl">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        {tabs.map(tb => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`mat-btn flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all ${
              tab === tb.id ? 'bg-primary text-white border-primary' : 'bg-surface-variant/40 border-black/10 text-on-surface/70 hover:bg-surface-variant'
            }`}
          >
            <span className="material-symbols-rounded text-base">{tb.icon}</span>
            {isAr ? tb.ar : tb.en}
          </button>
        ))}
      </div>

      {tab === 'table' && (
        <div className="space-y-4">
          {/* Periodic grid */}
          <div className="rounded-2xl border border-black/10 bg-white p-3 overflow-x-auto scroll-thin">
            <div className="grid gap-[3px] min-w-[820px]" style={{ gridTemplateColumns: 'repeat(18, minmax(0,1fr))', gridAutoRows: 'auto' }}>
              {ELEMENTS.map(el => {
                const placed = CATEGORY_COLOR[el.cat];
                const highlight = selected?.n === el.n;
                return (
                  <button
                    key={el.n}
                    onClick={() => setSelected(el)}
                    title={`${el.sym} · ${el.ar} (${el.n})`}
                    className={`mat-btn flex flex-col items-center rounded-[4px] text-white aspect-square cursor-pointer transition-all ${
                      highlight ? 'ring-2 ring-primary scale-110 z-10 shadow-lg' : 'hover:scale-110 hover:z-10'
                    }`}
                    style={{
                      backgroundColor: placed,
                      minWidth: 0,
                      gridColumnStart: el.c,
                      gridRowStart: el.r,
                    }}
                  >
                    <span className="text-[9px] leading-none opacity-80 mt-0.5">{el.n}</span>
                    <span className="text-[11px] md:text-xs font-bold leading-tight">{el.sym}</span>
                  </button>
                );
              })}
              <div className="col-span-18 grid-cols-18 opacity-0" />
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-on-surface/70">
              {Object.entries(CATEGORY_LABEL).map(([cat, label]) => (
                <span key={cat} className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: CATEGORY_COLOR[cat as keyof typeof CATEGORY_COLOR] }} />
                  {isAr ? label.ar : label.en}
                </span>
              ))}
            </div>
          </div>

          {/* Selected element card */}
          {selected && (
            <div className="rounded-2xl border border-black/10 bg-white p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-xl text-white flex flex-col items-center justify-center shadow-lg" style={{ backgroundColor: CATEGORY_COLOR[selected.cat] }}>
                  <span className="text-[11px] opacity-80">{selected.n}</span>
                  <span className="text-3xl font-bold">{selected.sym}</span>
                  <span className="text-[11px]">{isAr ? selected.ar : selected.name}</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-on-surface">{isAr ? selected.ar : selected.name} <span className="text-on-surface/50 text-base" dir="ltr">({selected.sym})</span></h3>
                  <p className="text-sm text-on-surface/60">
                    {t('العدد الذري', 'Atomic number')}: <b dir="ltr">{selected.n}</b> · {t('الكتلة', 'Mass')}: <b dir="ltr">{selected.mass} u</b>
                  </p>
                  <p className="text-sm text-on-surface/60">
                    {t('المجموعة/التصنيف', 'Category')}: <b>{isAr ? CATEGORY_LABEL[selected.cat].ar : CATEGORY_LABEL[selected.cat].en}</b>
                  </p>
                </div>
              </div>
              <button
                onClick={() => onPlaceElement(selected)}
                className="mat-btn px-5 py-2.5 rounded-full bg-primary text-white font-medium shadow-elev-1"
              >
                <span className="material-symbols-rounded text-base align-middle -mt-0.5 me-1">add_to_board</span>
                {t('أضف للسبورة', 'Add to board')}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'balancer' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-black/10 p-4">
            <label className="text-sm font-medium text-on-surface/70 flex items-center gap-2 mb-2">
              <span className="material-symbols-rounded text-base">arrow_right_alt</span>
              {t('أدخل المعادلة (المواد المتفاعلة ← النواتج)', 'Enter equation (reactants → products)')}
            </label>
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              <input
                dir="ltr"
                value={lhs}
                onChange={e => setLhs(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-black/10 bg-surface-variant/40 focus:bg-white focus:border-primary focus:outline-none text-sm font-mono text-center"
                placeholder="H2 + O2"
              />
              <span className="text-2xl text-on-surface/40">→</span>
              <input
                dir="ltr"
                value={rhs}
                onChange={e => setRhs(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-black/10 bg-surface-variant/40 focus:bg-white focus:border-primary focus:outline-none text-sm font-mono text-center"
                placeholder="H2O"
              />
            </div>
            {balanced && (
              <div className={`mt-3 rounded-xl px-4 py-3 font-mono text-center text-base font-semibold ${
                balanced.balanced ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'
              }`} dir="ltr">
                {equationToString(balanced, isAr)}
              </div>
            )}
            {balanced && !balanced.balanced && balanced.error && (
              <p className="text-xs text-amber-600 mt-1">{isAr ? 'لا يمكن الموازنة تلقائيًا لهذه الصيغة.' : 'Cannot auto-balance this equation.'} {balanced.error}</p>
            )}
            <div className="flex gap-3 mt-3">
              <button
                onClick={placeReaction}
                disabled={!balanced}
                className="mat-btn px-4 py-2 rounded-full bg-primary text-white text-sm font-medium shadow-elev-1 disabled:opacity-40"
              >
                {t('ضع المعادلة على السبورة', 'Place on board')}
              </button>
              <button
                onClick={() => { setLhs('Fe + CuSO4'); setRhs('FeSO4 + Cu'); }}
                className="mat-btn px-4 py-2 rounded-full border border-black/10 text-on-surface/80 text-sm hover:bg-surface-variant/50"
              >
                {t('مثال', 'Example')}
              </button>
            </div>
          </div>
          <div className="text-xs text-on-surface/50">
            {t('أمثلة جاهزة للموازنة', 'Ready-to-balance examples')}: H2 + O2 → H2O · CH4 + O2 → CO2 + H2O · Fe + O2 → Fe2O3 · N2 + H2 → NH3
          </div>
        </div>
      )}

      {tab === 'reactions' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-black/10 p-4">
            <label className="text-sm font-medium text-on-surface/70 mb-2 flex items-center gap-2">
              <span className="material-symbols-rounded text-base">swap_horiz</span>
              {t('سلسلة النشاط الكيميائي (الإزاحة)', 'Reactivity series (displacement)')}
            </label>
            <div className="flex flex-wrap gap-3 items-center">
              <select
                value={metalA}
                onChange={e => setMetalA(e.target.value)}
                className="px-3 py-2 rounded-xl border border-black/10 bg-surface-variant/40 focus:outline-none text-sm"
              >
                {REACTIVITY_SERIES.map(m => <option key={m} value={m}>{m} — {isAr ? REACTIVITY_NAMES[m]?.ar : REACTIVITY_NAMES[m]?.en}</option>)}
              </select>
              <span className="text-on-surface/50">vs</span>
              <select
                value={metalB}
                onChange={e => setMetalB(e.target.value)}
                className="px-3 py-2 rounded-xl border border-black/10 bg-surface-variant/40 focus:outline-none text-sm"
              >
                {REACTIVITY_SERIES.map(m => <option key={m} value={m}>{m} — {isAr ? REACTIVITY_NAMES[m]?.ar : REACTIVITY_NAMES[m]?.en}</option>)}
              </select>
            </div>
            <div className={`mt-3 rounded-xl px-4 py-3 text-sm font-medium ${
              doesDisplace(metalA, metalB) ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'
            }`}>
              {doesDisplace(metalA, metalB)
                ? t(`${REACTIVITY_NAMES[metalA]?.ar || metalA} يزيح ${REACTIVITY_NAMES[metalB]?.ar || metalB} من مركباته.`, `${metalA} displaces ${metalB} from its compounds.`)
                : metalA === metalB
                  ? t('اختر معدنين مختلفين.', 'Choose two different metals.')
                  : t(`${REACTIVITY_NAMES[metalA]?.ar || metalA} لا يزيح ${REACTIVITY_NAMES[metalB]?.ar || metalB}.`, `${metalA} does NOT displace ${metalB}.`)}
            </div>
            <div className="mt-3 flex gap-2 flex-wrap">
              {DISPLACEMENT_EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => onPlaceText(isAr ? ex.ar : ex.en, [`${ex.lhs} → ${ex.rhs}`])}
                  className="mat-btn px-3 py-1.5 rounded-full border border-black/10 text-xs text-on-surface/80 hover:bg-surface-variant/50"
                >
                  {ex.lhs} → {ex.rhs}
                </button>
              ))}
            </div>
            <p className="text-xs text-on-surface/50 mt-3">
              {t('ترتيب النشاط', 'Activity order')} (أعلى = أكثر نشاطًا): {REACTIVITY_SERIES.join(' > ')}
            </p>
            <button
              onClick={() => onPlaceText(t('سلسلة النشاط الكيميائي', 'Reactivity series'), REACTIVITY_SERIES.map(m => `${m} — ${isAr ? REACTIVITY_NAMES[m]?.ar : REACTIVITY_NAMES[m]?.en}`))}
              className="mat-btn mt-3 px-4 py-2 rounded-full bg-primary text-white text-sm font-medium shadow-elev-1"
            >
              {t('ضع السلسلة على السبورة', 'Place series on board')}
            </button>
          </div>
        </div>
      )}

      {tab === 'materials' && (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-black/10 p-4">
            <h4 className="font-semibold text-on-surface flex items-center gap-2 mb-2">
              <span className="material-symbols-rounded text-[#e74c3c] text-base">science</span>
              {t('الأحماض الشائعة', 'Common acids')}
            </h4>
            <ul className="space-y-1.5 text-sm">
              {COMPANION_MATERIALS.acids.map(a => (
                <li key={a.name} className="flex justify-between items-center">
                  <span>{isAr ? a.ar : a.en}</span>
                  <code className="text-xs bg-surface-variant/50 px-1.5 py-0.5 rounded font-mono" dir="ltr">{a.formula}</code>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white rounded-2xl border border-black/10 p-4">
            <h4 className="font-semibold text-on-surface flex items-center gap-2 mb-2">
              <span className="material-symbols-rounded text-[#2980b9] text-base">water_drop</span>
              {t('القواعد الشائعة', 'Common bases')}
            </h4>
            <ul className="space-y-1.5 text-sm">
              {COMPANION_MATERIALS.bases.map(a => (
                <li key={a.name} className="flex justify-between items-center">
                  <span>{isAr ? a.ar : a.en}</span>
                  <code className="text-xs bg-surface-variant/50 px-1.5 py-0.5 rounded font-mono" dir="ltr">{a.formula}</code>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white rounded-2xl border border-black/10 p-4">
            <h4 className="font-semibold text-on-surface flex items-center gap-2 mb-2">
              <span className="material-symbols-rounded text-[#27ae60] text-base">blur_on</span>
              {t('الأيونات متعددة الذرات', 'Polyatomic ions')}
            </h4>
            <ul className="space-y-1.5 text-sm">
              {POLYATOMIC_IONS.map(a => (
                <li key={a.name} className="flex justify-between items-center">
                  <span>{isAr ? a.ar : a.en}</span>
                  <code className="text-xs bg-surface-variant/50 px-1.5 py-0.5 rounded font-mono" dir="ltr">{a.name}{a.charge}</code>
                </li>
              ))}
            </ul>
          </div>
          <div className="md:col-span-3 bg-white rounded-2xl border border-black/10 p-4">
            <h4 className="font-semibold text-on-surface flex items-center gap-2 mb-2">
              <span className="material-symbols-rounded text-primary text-base">stacked_bar_chart</span>
              {t('الأملاح الشائعة', 'Common salts')}
            </h4>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              {COMPANION_MATERIALS.commonSalts.map(a => (
                <div key={a.name} className="flex justify-between items-center bg-surface-variant/30 px-3 py-2 rounded-xl">
                  <span>{isAr ? a.ar : a.en}</span>
                  <code className="text-xs font-mono" dir="ltr">{a.formula}</code>
                </div>
              ))}
            </div>
            <button
              onClick={() => onPlaceText(t('مواد مرافقة — أحماض', 'Companion materials — acids'), COMPANION_MATERIALS.acids.map(a => `${isAr ? a.ar : a.en} (${a.formula})`))}
              className="mat-btn mt-3 px-4 py-2 rounded-full bg-primary text-white text-sm font-medium shadow-elev-1"
            >
              {t('ضع القائمة على السبورة', 'Place list on board')}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
};

export default SmartLabPanel;