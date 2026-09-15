import React, { useState } from 'react';

interface GeometryToolsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  language: string;
}

type TabType = 'shapes' | 'theorems' | 'latex';

export const GeometryToolsOverlay: React.FC<GeometryToolsOverlayProps> = ({
  isOpen,
  onClose,
  language,
}) => {
  const isAr = language.toLowerCase().startsWith('ar');
  const [activeTab, setActiveTab] = useState<TabType>('shapes');

  // Interactive Shape calculations state
  const [selectedShape, setSelectedShape] = useState<'rightTriangle' | 'isosceles' | 'equilateral' | 'circle' | 'parallelogram'>('rightTriangle');
  const [sideA, setSideA] = useState<number>(3);
  const [sideB, setSideB] = useState<number>(4);
  const [radius, setRadius] = useState<number>(5);

  // LaTeX & Theorem states
  const [activeTheorem, setActiveTheorem] = useState<'pythagoras' | 'area' | 'thales' | 'circleTheory'>('pythagoras');
  const [customLatex, setCustomLatex] = useState<string>('a^2 + b^2 = c^2');

  if (!isOpen) return null;

  // Compute geometry metrics dynamically
  const pythagorasHyp = Math.sqrt(sideA * sideA + sideB * sideB).toFixed(2);
  const rightTriangleArea = (0.5 * sideA * sideB).toFixed(2);
  const circleArea = (Math.PI * radius * radius).toFixed(2);
  const circleCircumference = (2 * Math.PI * radius).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in font-arabic">
      <div className="bg-[#080D1E] border border-white/10 text-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-rounded text-[#D946EF] text-2xl">architecture</span>
            <h2 className="text-lg font-bold text-white">
              {isAr ? 'الأشكال والنظريات الهندسية (LaTeX)' : 'Geometry Shapes & Theorems'}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label={isAr ? 'إغلاق' : 'Close'}
            className="p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>

        {/* Tab Selection Navigation */}
        <div className="flex border-b border-white/10 bg-black/30 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('shapes')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'shapes'
                ? 'border-[#00E5FF] text-[#00E5FF] bg-white/5'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <span className="material-symbols-rounded text-sm">category</span>
            {isAr ? 'الأشكال الهندسية' : 'Geometric Shapes'}
          </button>

          <button
            onClick={() => setActiveTab('theorems')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'theorems'
                ? 'border-[#F59E0B] text-[#F59E0B] bg-white/5'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <span className="material-symbols-rounded text-sm">functions</span>
            {isAr ? 'النظريات والقوانين' : 'Theorems & Laws'}
          </button>

          <button
            onClick={() => setActiveTab('latex')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'latex'
                ? 'border-[#D946EF] text-[#D946EF] bg-white/5'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <span className="material-symbols-rounded text-sm">draw</span>
            {isAr ? 'محرر صيغ LaTeX' : 'LaTeX Formula Renderer'}
          </button>
        </div>

        {/* Tab Body Contents */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* TAB 1: Geometric Shapes */}
          {activeTab === 'shapes' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Selector List */}
              <div className="flex flex-col gap-2">
                <span className="text-xs text-[#00E5FF] font-bold mb-1">
                  {isAr ? 'اختر الشكل:' : 'Select Shape:'}
                </span>
                {[
                  { id: 'rightTriangle', labelAr: 'مثلث قائم الزاويه (Right Triangle)', labelEn: 'Right Triangle' },
                  { id: 'isosceles', labelAr: 'مثلث متساوي الساقين (Isosceles)', labelEn: 'Isosceles Triangle' },
                  { id: 'equilateral', labelAr: 'مثلث متساوي الأضلاع (Equilateral)', labelEn: 'Equilateral Triangle' },
                  { id: 'circle', labelAr: 'الدائرة (Circle)', labelEn: 'Circle' },
                  { id: 'parallelogram', labelAr: 'متوازي الأضلاع (Parallelogram)', labelEn: 'Parallelogram' },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedShape(s.id as any)}
                    className={`p-3 rounded-xl text-xs text-start font-medium transition-all border ${
                      selectedShape === s.id
                        ? 'bg-[#00E5FF]/10 border-[#00E5FF] text-[#00E5FF]'
                        : 'bg-white/5 border-white/5 text-white/80 hover:bg-white/10'
                    }`}
                  >
                    {isAr ? s.labelAr : s.labelEn}
                  </button>
                ))}
              </div>

              {/* Center Interactive SVG Diagram */}
              <div className="md:col-span-2 bg-black/40 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-between">
                <div className="w-full h-48 flex items-center justify-center relative">
                  {selectedShape === 'rightTriangle' && (
                    <svg width="200" height="150" viewBox="0 0 200 150">
                      <polygon points="30,120 170,120 30,20" fill="rgba(0, 229, 255, 0.15)" stroke="#00E5FF" strokeWidth="3" />
                      <rect x="30" y="105" width="15" height="15" fill="none" stroke="#F59E0B" strokeWidth="2" />
                      <text x="100" y="140" fill="#fff" fontSize="12" textAnchor="middle">a = {sideA}</text>
                      <text x="15" y="70" fill="#fff" fontSize="12" textAnchor="middle">b = {sideB}</text>
                      <text x="110" y="65" fill="#D946EF" fontSize="12" fontWeight="bold">c = {pythagorasHyp}</text>
                    </svg>
                  )}

                  {selectedShape === 'circle' && (
                    <svg width="180" height="180" viewBox="0 0 180 180">
                      <circle cx="90" cy="90" r="70" fill="rgba(217, 70, 239, 0.15)" stroke="#D946EF" strokeWidth="3" />
                      <line x1="90" y1="90" x2="160" y2="90" stroke="#F59E0B" strokeWidth="2" strokeDasharray="4" />
                      <circle cx="90" cy="90" r="4" fill="#00E5FF" />
                      <text x="125" y="80" fill="#F59E0B" fontSize="12" fontWeight="bold">r = {radius}</text>
                    </svg>
                  )}

                  {(selectedShape === 'isosceles' || selectedShape === 'equilateral') && (
                    <svg width="200" height="150" viewBox="0 0 200 150">
                      <polygon points="100,20 30,130 170,130" fill="rgba(245, 158, 11, 0.15)" stroke="#F59E0B" strokeWidth="3" />
                      <text x="100" y="145" fill="#fff" fontSize="12" textAnchor="middle">Base (القاعدة)</text>
                    </svg>
                  )}

                  {selectedShape === 'parallelogram' && (
                    <svg width="220" height="140" viewBox="0 0 220 140">
                      <polygon points="50,20 200,20 170,120 20,120" fill="rgba(0, 229, 255, 0.15)" stroke="#00E5FF" strokeWidth="3" />
                      <text x="110" y="75" fill="#fff" fontSize="12" textAnchor="middle">Parallelogram</text>
                    </svg>
                  )}
                </div>

                {/* Input Controls & Metrics Calculation */}
                <div className="w-full border-t border-white/10 pt-3 flex flex-col gap-2">
                  {selectedShape === 'rightTriangle' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-white/70 block mb-1">الضلع الأول (a):</label>
                        <input
                          type="number"
                          value={sideA}
                          onChange={(e) => setSideA(Math.max(1, Number(e.target.value)))}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-white/70 block mb-1">الضلع الثاني (b):</label>
                        <input
                          type="number"
                          value={sideB}
                          onChange={(e) => setSideB(Math.max(1, Number(e.target.value)))}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                        />
                      </div>
                    </div>
                  )}

                  {selectedShape === 'circle' && (
                    <div>
                      <label className="text-[11px] text-white/70 block mb-1">نصف القطر (r):</label>
                      <input
                        type="number"
                        value={radius}
                        onChange={(e) => setRadius(Math.max(1, Number(e.target.value)))}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                      />
                    </div>
                  )}

                  <div className="bg-white/5 rounded-xl p-2 text-xs flex justify-around text-center">
                    {selectedShape === 'rightTriangle' && (
                      <>
                        <div>
                          <span className="text-white/50 block text-[10px]">الوتر (Hypotenuse):</span>
                          <span className="font-mono text-[#D946EF] font-bold">{pythagorasHyp}</span>
                        </div>
                        <div>
                          <span className="text-white/50 block text-[10px]">المساحة (Area):</span>
                          <span className="font-mono text-[#00E5FF] font-bold">{rightTriangleArea}</span>
                        </div>
                      </>
                    )}
                    {selectedShape === 'circle' && (
                      <>
                        <div>
                          <span className="text-white/50 block text-[10px]">المساحة (Area):</span>
                          <span className="font-mono text-[#D946EF] font-bold">{circleArea}</span>
                        </div>
                        <div>
                          <span className="text-white/50 block text-[10px]">المحيط (Circumference):</span>
                          <span className="font-mono text-[#F59E0B] font-bold">{circleCircumference}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Mathematical Theorems */}
          {activeTab === 'theorems' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { id: 'pythagoras', title: 'نظرية فيثاغورس (Pythagoras)' },
                  { id: 'area', title: 'مساحة المثلث (Triangle Area)' },
                  { id: 'thales', title: 'نظرية طاليس (Thales Theorem)' },
                  { id: 'circleTheory', title: 'قوانين الدائرة (Circle Laws)' },
                ].map((th) => (
                  <button
                    key={th.id}
                    onClick={() => setActiveTheorem(th.id as any)}
                    className={`p-2.5 rounded-xl text-xs font-semibold text-center border transition-all ${
                      activeTheorem === th.id
                        ? 'bg-[#F59E0B]/10 border-[#F59E0B] text-[#F59E0B]'
                        : 'bg-white/5 border-white/5 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {th.title}
                  </button>
                ))}
              </div>

              <div className="bg-black/40 border border-white/10 rounded-2xl p-5 space-y-4">
                {activeTheorem === 'pythagoras' && (
                  <div>
                    <h3 className="text-[#F59E0B] font-bold text-sm mb-2">نظرية فيثاغورس (Pythagorean Theorem)</h3>
                    <p className="text-xs text-white/80 leading-relaxed mb-3">
                      في المثلث القائم الزاوية، مربع طول الوتر يساوي مجموع مربعي طولي الضلعين المحاذيين للزاوية القائمة.
                    </p>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 font-mono text-center text-sm text-[#00E5FF]">
                      a^2 + b^2 = c^2 \implies c = \sqrt{`{a^2 + b^2}`}
                    </div>
                  </div>
                )}

                {activeTheorem === 'area' && (
                  <div>
                    <h3 className="text-[#F59E0B] font-bold text-sm mb-2">مساحة المثلث (Triangle Area)</h3>
                    <p className="text-xs text-white/80 leading-relaxed mb-3">
                      مساحة أي مثلث تساوي نصف حاصل ضرب طول القاعدة في الارتفاع العمودي عليها.
                    </p>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 font-mono text-center text-sm text-[#00E5FF]">
                      \text{`{Area}`} = \frac{`{1}`}{`{2}`} \times \text{`{Base}`} \times \text{`{Height}`}
                    </div>
                  </div>
                )}

                {activeTheorem === 'thales' && (
                  <div>
                    <h3 className="text-[#F59E0B] font-bold text-sm mb-2">نظرية طاليس (Thales Theorem)</h3>
                    <p className="text-xs text-white/80 leading-relaxed mb-3">
                      إذا تقاطع خطان مستقيمان مع عدة مستقيمات متوازية، فإن أطوال القطع المستقيمة المتقاطعة تكون متناسبة.
                    </p>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 font-mono text-center text-sm text-[#00E5FF]">
                      \frac{`{AB}`}{`{A'B'}`} = \frac{`{BC}`}{`{B'C'}`} = \frac{`{AC}`}{`{A'C'}`}
                    </div>
                  </div>
                )}

                {activeTheorem === 'circleTheory' && (
                  <div>
                    <h3 className="text-[#F59E0B] font-bold text-sm mb-2">قوانين الدائرة (Circle Equations)</h3>
                    <p className="text-xs text-white/80 leading-relaxed mb-3">
                      معادلة الدائرة في المستوى الإحداثي بنصف قطر r ومتحركة عند المركز (h, k).
                    </p>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 font-mono text-center text-sm text-[#00E5FF]">
                      (x - h)^2 + (y - k)^2 = r^2
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: LaTeX Renderer */}
          {activeTab === 'latex' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#D946EF] block mb-1">
                  أدخل صيغة LaTeX الرياضية (Enter LaTeX Formula):
                </label>
                <input
                  type="text"
                  value={customLatex}
                  onChange={(e) => setCustomLatex(e.target.value)}
                  placeholder="\int_{a}^{b} f(x) \, dx"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-[#D946EF]"
                />
              </div>

              {/* Formatted Render Output */}
              <div className="bg-black/50 border border-[#D946EF]/30 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[140px] text-center">
                <span className="text-[10px] text-white/40 block mb-2 font-mono uppercase">LaTeX Output Render</span>
                <div className="font-mono text-base text-[#00E5FF] tracking-widest bg-white/5 px-6 py-3 rounded-xl border border-white/10">
                  {customLatex || 'Latex expression preview'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GeometryToolsOverlay;
