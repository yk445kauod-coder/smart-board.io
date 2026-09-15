import React, { useState, useRef } from 'react';

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
  const [selectedShape, setSelectedShape] = useState<'rightTriangle' | 'isosceles' | 'equilateral' | 'scalene' | 'circle' | 'square' | 'parallelogram' | 'trapezoid'>('rightTriangle');
  const [sideA, setSideA] = useState<number>(3);
  const [sideB, setSideB] = useState<number>(4);
  const [sideC, setSideC] = useState<number>(5);
  const [radius, setRadius] = useState<number>(5);
  const [base2, setBase2] = useState<number>(6);
  const [height, setHeight] = useState<number>(4);

  // LaTeX & Theorem states
  const [activeTheorem, setActiveTheorem] = useState<'pythagoras' | 'area' | 'thales' | 'circleTheory' | 'sineLaw' | 'euclid'>('pythagoras');
  const [customLatex, setCustomLatex] = useState<string>('a^2 + b^2 = c^2');

  // Drawing canvas overlay over LaTeX
  const latexCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawingLatex, setIsDrawingLatex] = useState(false);
  const [drawColor, setDrawColor] = useState('#00E5FF');

  const startDrawingLatex = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawingLatex(true);
    const canvas = latexCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const drawOnLatex = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingLatex) return;
    const canvas = latexCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.strokeStyle = drawColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawingLatex = () => {
    setIsDrawingLatex(false);
  };

  const clearLatexCanvas = () => {
    const canvas = latexCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  if (!isOpen) return null;

  // Compute geometry metrics dynamically
  const pythagorasHyp = Math.sqrt(sideA * sideA + sideB * sideB).toFixed(2);
  const rightTriangleArea = (0.5 * sideA * sideB).toFixed(2);
  const rightTrianglePerimeter = (sideA + sideB + Math.sqrt(sideA * sideA + sideB * sideB)).toFixed(2);

  const isoscelesHeight = Math.sqrt(Math.max(1, sideA * sideA - (sideB / 2) * (sideB / 2))).toFixed(2);
  const isoscelesArea = (0.5 * sideB * parseFloat(isoscelesHeight)).toFixed(2);
  const isoscelesPerimeter = (2 * sideA + sideB).toFixed(2);

  const equilateralHeight = ((Math.sqrt(3) / 2) * sideA).toFixed(2);
  const equilateralArea = (((Math.sqrt(3) / 4) * sideA * sideA)).toFixed(2);
  const equilateralPerimeter = (3 * sideA).toFixed(2);

  const scalenePerimeter = sideA + sideB + sideC;
  const s = scalenePerimeter / 2;
  const scaleneAreaVal = Math.sqrt(Math.max(0, s * (s - sideA) * (s - sideB) * (s - sideC)));
  const scaleneArea = scaleneAreaVal > 0 ? scaleneAreaVal.toFixed(2) : 'غير ممكن (Invalid)';

  const circleArea = (Math.PI * radius * radius).toFixed(2);
  const circleCircumference = (2 * Math.PI * radius).toFixed(2);

  const squareArea = (sideA * sideA).toFixed(2);
  const squarePerimeter = (4 * sideA).toFixed(2);
  const squareDiagonal = (sideA * Math.sqrt(2)).toFixed(2);

  const parallelogramArea = (sideA * height).toFixed(2);
  const parallelogramPerimeter = (2 * (sideA + sideB)).toFixed(2);

  const trapezoidArea = (0.5 * (sideA + base2) * height).toFixed(2);

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
                  { id: 'rightTriangle', labelAr: 'مثلث قائم الزاوية (Right Triangle)', labelEn: 'Right Triangle' },
                  { id: 'isosceles', labelAr: 'مثلث متساوي الساقين (Isosceles)', labelEn: 'Isosceles Triangle' },
                  { id: 'equilateral', labelAr: 'مثلث متساوي الأضلاع (Equilateral)', labelEn: 'Equilateral Triangle' },
                  { id: 'scalene', labelAr: 'مثلث مختلف الأضلاع (Scalene)', labelEn: 'Scalene Triangle' },
                  { id: 'circle', labelAr: 'الدائرة (Circle)', labelEn: 'Circle' },
                  { id: 'square', labelAr: 'المربع (Square)', labelEn: 'Square' },
                  { id: 'parallelogram', labelAr: 'متوازي الأضلاع (Parallelogram)', labelEn: 'Parallelogram' },
                  { id: 'trapezoid', labelAr: 'شبه المنحرف (Trapezoid)', labelEn: 'Trapezoid' },
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

                  {selectedShape === 'isosceles' && (
                    <svg width="200" height="150" viewBox="0 0 200 150">
                      <polygon points="100,20 30,130 170,130" fill="rgba(245, 158, 11, 0.15)" stroke="#F59E0B" strokeWidth="3" />
                      <line x1="100" y1="20" x2="100" y2="130" stroke="#00E5FF" strokeWidth="1.5" strokeDasharray="4" />
                      <text x="100" y="145" fill="#fff" fontSize="12" textAnchor="middle">b = {sideB}</text>
                      <text x="55" y="70" fill="#F59E0B" fontSize="12">a = {sideA}</text>
                      <text x="145" y="70" fill="#F59E0B" fontSize="12">a = {sideA}</text>
                    </svg>
                  )}

                  {selectedShape === 'equilateral' && (
                    <svg width="200" height="150" viewBox="0 0 200 150">
                      <polygon points="100,20 30,130 170,130" fill="rgba(217, 70, 239, 0.15)" stroke="#D946EF" strokeWidth="3" />
                      <text x="100" y="145" fill="#fff" fontSize="12" textAnchor="middle">a = {sideA}</text>
                      <text x="50" y="75" fill="#D946EF" fontSize="12">a = {sideA}</text>
                      <text x="150" y="75" fill="#D946EF" fontSize="12">a = {sideA}</text>
                    </svg>
                  )}

                  {selectedShape === 'scalene' && (
                    <svg width="200" height="150" viewBox="0 0 200 150">
                      <polygon points="40,30 180,130 20,130" fill="rgba(0, 229, 255, 0.15)" stroke="#00E5FF" strokeWidth="3" />
                      <text x="100" y="145" fill="#fff" fontSize="12" textAnchor="middle">a = {sideA}</text>
                      <text x="20" y="80" fill="#F59E0B" fontSize="12">b = {sideB}</text>
                      <text x="120" y="70" fill="#D946EF" fontSize="12">c = {sideC}</text>
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

                  {selectedShape === 'square' && (
                    <svg width="160" height="150" viewBox="0 0 160 150">
                      <rect x="30" y="25" width="100" height="100" fill="rgba(0, 229, 255, 0.15)" stroke="#00E5FF" strokeWidth="3" />
                      <line x1="30" y1="125" x2="130" y2="25" stroke="#D946EF" strokeWidth="1.5" strokeDasharray="4" />
                      <text x="80" y="142" fill="#fff" fontSize="12" textAnchor="middle">Side = {sideA}</text>
                    </svg>
                  )}

                  {selectedShape === 'parallelogram' && (
                    <svg width="220" height="140" viewBox="0 0 220 140">
                      <polygon points="50,20 200,20 170,120 20,120" fill="rgba(0, 229, 255, 0.15)" stroke="#00E5FF" strokeWidth="3" />
                      <line x1="50" y1="20" x2="50" y2="120" stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="4" />
                      <text x="110" y="135" fill="#fff" fontSize="12" textAnchor="middle">Base (a) = {sideA}</text>
                      <text x="25" y="70" fill="#F59E0B" fontSize="12">h = {height}</text>
                    </svg>
                  )}

                  {selectedShape === 'trapezoid' && (
                    <svg width="220" height="140" viewBox="0 0 220 140">
                      <polygon points="60,25 160,25 200,115 20,115" fill="rgba(245, 158, 11, 0.15)" stroke="#F59E0B" strokeWidth="3" />
                      <line x1="60" y1="25" x2="60" y2="115" stroke="#D946EF" strokeWidth="1.5" strokeDasharray="4" />
                      <text x="110" y="18" fill="#fff" fontSize="12" textAnchor="middle">b1 = {sideA}</text>
                      <text x="110" y="132" fill="#fff" fontSize="12" textAnchor="middle">b2 = {base2}</text>
                      <text x="40" y="70" fill="#D946EF" fontSize="12">h = {height}</text>
                    </svg>
                  )}
                </div>

                {/* Input Controls & Metrics Calculation */}
                <div className="w-full border-t border-white/10 pt-3 flex flex-col gap-2">
                  {selectedShape === 'rightTriangle' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-white/70 block mb-1">{isAr ? 'الضلع الأول (a):' : 'Side a:'}</label>
                        <input
                          type="number"
                          value={sideA}
                          onChange={(e) => setSideA(Math.max(1, Number(e.target.value)))}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-white/70 block mb-1">{isAr ? 'الضلع الثاني (b):' : 'Side b:'}</label>
                        <input
                          type="number"
                          value={sideB}
                          onChange={(e) => setSideB(Math.max(1, Number(e.target.value)))}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                        />
                      </div>
                    </div>
                  )}

                  {selectedShape === 'isosceles' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-white/70 block mb-1">{isAr ? 'طول الساقين (a):' : 'Equal Leg (a):'}</label>
                        <input
                          type="number"
                          value={sideA}
                          onChange={(e) => setSideA(Math.max(1, Number(e.target.value)))}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-white/70 block mb-1">{isAr ? 'القاعدة (b):' : 'Base (b):'}</label>
                        <input
                          type="number"
                          value={sideB}
                          onChange={(e) => setSideB(Math.max(1, Number(e.target.value)))}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                        />
                      </div>
                    </div>
                  )}

                  {selectedShape === 'equilateral' && (
                    <div>
                      <label className="text-[11px] text-white/70 block mb-1">{isAr ? 'طول الضلع (a):' : 'Side Length (a):'}</label>
                      <input
                        type="number"
                        value={sideA}
                        onChange={(e) => setSideA(Math.max(1, Number(e.target.value)))}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                      />
                    </div>
                  )}

                  {selectedShape === 'scalene' && (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[11px] text-white/70 block mb-1">a:</label>
                        <input
                          type="number"
                          value={sideA}
                          onChange={(e) => setSideA(Math.max(1, Number(e.target.value)))}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-white/70 block mb-1">b:</label>
                        <input
                          type="number"
                          value={sideB}
                          onChange={(e) => setSideB(Math.max(1, Number(e.target.value)))}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-white/70 block mb-1">c:</label>
                        <input
                          type="number"
                          value={sideC}
                          onChange={(e) => setSideC(Math.max(1, Number(e.target.value)))}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                        />
                      </div>
                    </div>
                  )}

                  {selectedShape === 'circle' && (
                    <div>
                      <label className="text-[11px] text-white/70 block mb-1">{isAr ? 'نصف القطر (r):' : 'Radius (r):'}</label>
                      <input
                        type="number"
                        value={radius}
                        onChange={(e) => setRadius(Math.max(1, Number(e.target.value)))}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                      />
                    </div>
                  )}

                  {selectedShape === 'square' && (
                    <div>
                      <label className="text-[11px] text-white/70 block mb-1">{isAr ? 'طول الضلع (Side):' : 'Side Length:'}</label>
                      <input
                        type="number"
                        value={sideA}
                        onChange={(e) => setSideA(Math.max(1, Number(e.target.value)))}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                      />
                    </div>
                  )}

                  {selectedShape === 'parallelogram' && (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[11px] text-white/70 block mb-1">{isAr ? 'القاعدة (a):' : 'Base (a):'}</label>
                        <input
                          type="number"
                          value={sideA}
                          onChange={(e) => setSideA(Math.max(1, Number(e.target.value)))}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-white/70 block mb-1">{isAr ? 'الضلع المائل (b):' : 'Side (b):'}</label>
                        <input
                          type="number"
                          value={sideB}
                          onChange={(e) => setSideB(Math.max(1, Number(e.target.value)))}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-white/70 block mb-1">{isAr ? 'الارتفاع (h):' : 'Height (h):'}</label>
                        <input
                          type="number"
                          value={height}
                          onChange={(e) => setHeight(Math.max(1, Number(e.target.value)))}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                        />
                      </div>
                    </div>
                  )}

                  {selectedShape === 'trapezoid' && (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[11px] text-white/70 block mb-1">{isAr ? 'القاعدة 1 (b1):' : 'Base 1 (b1):'}</label>
                        <input
                          type="number"
                          value={sideA}
                          onChange={(e) => setSideA(Math.max(1, Number(e.target.value)))}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-white/70 block mb-1">{isAr ? 'القاعدة 2 (b2):' : 'Base 2 (b2):'}</label>
                        <input
                          type="number"
                          value={base2}
                          onChange={(e) => setBase2(Math.max(1, Number(e.target.value)))}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-white/70 block mb-1">{isAr ? 'الارتفاع (h):' : 'Height (h):'}</label>
                        <input
                          type="number"
                          value={height}
                          onChange={(e) => setHeight(Math.max(1, Number(e.target.value)))}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                        />
                      </div>
                    </div>
                  )}

                  <div className="bg-white/5 rounded-xl p-2 text-xs flex justify-around text-center">
                    {selectedShape === 'rightTriangle' && (
                      <>
                        <div>
                          <span className="text-white/50 block text-[10px]">{isAr ? 'الوتر (Hypotenuse):' : 'Hypotenuse:'}</span>
                          <span className="font-mono text-[#D946EF] font-bold">{pythagorasHyp}</span>
                        </div>
                        <div>
                          <span className="text-white/50 block text-[10px]">{isAr ? 'المساحة (Area):' : 'Area:'}</span>
                          <span className="font-mono text-[#00E5FF] font-bold">{rightTriangleArea}</span>
                        </div>
                        <div>
                          <span className="text-white/50 block text-[10px]">{isAr ? 'المحيط (Perimeter):' : 'Perimeter:'}</span>
                          <span className="font-mono text-[#F59E0B] font-bold">{rightTrianglePerimeter}</span>
                        </div>
                      </>
                    )}

                    {selectedShape === 'isosceles' && (
                      <>
                        <div>
                          <span className="text-white/50 block text-[10px]">{isAr ? 'الارتفاع (Height):' : 'Height:'}</span>
                          <span className="font-mono text-[#00E5FF] font-bold">{isoscelesHeight}</span>
                        </div>
                        <div>
                          <span className="text-white/50 block text-[10px]">{isAr ? 'المساحة (Area):' : 'Area:'}</span>
                          <span className="font-mono text-[#D946EF] font-bold">{isoscelesArea}</span>
                        </div>
                        <div>
                          <span className="text-white/50 block text-[10px]">{isAr ? 'المحيط (Perimeter):' : 'Perimeter:'}</span>
                          <span className="font-mono text-[#F59E0B] font-bold">{isoscelesPerimeter}</span>
                        </div>
                      </>
                    )}

                    {selectedShape === 'equilateral' && (
                      <>
                        <div>
                          <span className="text-white/50 block text-[10px]">{isAr ? 'الارتفاع (Height):' : 'Height:'}</span>
                          <span className="font-mono text-[#00E5FF] font-bold">{equilateralHeight}</span>
                        </div>
                        <div>
                          <span className="text-white/50 block text-[10px]">{isAr ? 'المساحة (Area):' : 'Area:'}</span>
                          <span className="font-mono text-[#D946EF] font-bold">{equilateralArea}</span>
                        </div>
                        <div>
                          <span className="text-white/50 block text-[10px]">{isAr ? 'المحيط (Perimeter):' : 'Perimeter:'}</span>
                          <span className="font-mono text-[#F59E0B] font-bold">{equilateralPerimeter}</span>
                        </div>
                      </>
                    )}

                    {selectedShape === 'scalene' && (
                      <>
                        <div>
                          <span className="text-white/50 block text-[10px]">{isAr ? 'المساحة (Area):' : 'Area:'}</span>
                          <span className="font-mono text-[#00E5FF] font-bold">{scaleneArea}</span>
                        </div>
                        <div>
                          <span className="text-white/50 block text-[10px]">{isAr ? 'المحيط (Perimeter):' : 'Perimeter:'}</span>
                          <span className="font-mono text-[#F59E0B] font-bold">{scalenePerimeter}</span>
                        </div>
                      </>
                    )}

                    {selectedShape === 'circle' && (
                      <>
                        <div>
                          <span className="text-white/50 block text-[10px]">{isAr ? 'المساحة (Area):' : 'Area:'}</span>
                          <span className="font-mono text-[#D946EF] font-bold">{circleArea}</span>
                        </div>
                        <div>
                          <span className="text-white/50 block text-[10px]">{isAr ? 'المحيط (Circumference):' : 'Circumference:'}</span>
                          <span className="font-mono text-[#F59E0B] font-bold">{circleCircumference}</span>
                        </div>
                      </>
                    )}

                    {selectedShape === 'square' && (
                      <>
                        <div>
                          <span className="text-white/50 block text-[10px]">{isAr ? 'المساحة (Area):' : 'Area:'}</span>
                          <span className="font-mono text-[#00E5FF] font-bold">{squareArea}</span>
                        </div>
                        <div>
                          <span className="text-white/50 block text-[10px]">{isAr ? 'المحيط (Perimeter):' : 'Perimeter:'}</span>
                          <span className="font-mono text-[#F59E0B] font-bold">{squarePerimeter}</span>
                        </div>
                        <div>
                          <span className="text-white/50 block text-[10px]">{isAr ? 'القطر (Diagonal):' : 'Diagonal:'}</span>
                          <span className="font-mono text-[#D946EF] font-bold">{squareDiagonal}</span>
                        </div>
                      </>
                    )}

                    {selectedShape === 'parallelogram' && (
                      <>
                        <div>
                          <span className="text-white/50 block text-[10px]">{isAr ? 'المساحة (Area):' : 'Area:'}</span>
                          <span className="font-mono text-[#00E5FF] font-bold">{parallelogramArea}</span>
                        </div>
                        <div>
                          <span className="text-white/50 block text-[10px]">{isAr ? 'المحيط (Perimeter):' : 'Perimeter:'}</span>
                          <span className="font-mono text-[#F59E0B] font-bold">{parallelogramPerimeter}</span>
                        </div>
                      </>
                    )}

                    {selectedShape === 'trapezoid' && (
                      <div>
                        <span className="text-white/50 block text-[10px]">{isAr ? 'المساحة (Area):' : 'Area:'}</span>
                        <span className="font-mono text-[#00E5FF] font-bold">{trapezoidArea}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Mathematical Theorems */}
          {activeTab === 'theorems' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {[
                  { id: 'pythagoras', title: isAr ? '1. نظرية فيثاغورس (Pythagoras)' : '1. Pythagoras Theorem' },
                  { id: 'area', title: isAr ? '2. قانون الجيب والجيب تمام' : '2. Law of Sines & Cosines' },
                  { id: 'thales', title: isAr ? '3. نظرية طاليس (Thales Theorem)' : '3. Thales Theorem' },
                  { id: 'circleTheory', title: isAr ? '4. معادلات ونظريات الدائرة' : '4. Circle Theorems' },
                  { id: 'sineLaw', title: isAr ? '5. مجموع زوايا المثلث (180°)' : '5. Triangle Sum Theorem' },
                  { id: 'euclid', title: isAr ? '6. مسلمات إقليدس (Euclidean Geometry)' : '6. Euclidean Postulates' },
                ].map((th) => (
                  <button
                    key={th.id}
                    onClick={() => setActiveTheorem(th.id as any)}
                    className={`p-2.5 rounded-xl text-xs font-semibold text-start border transition-all ${
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
                    <h3 className="text-[#F59E0B] font-bold text-sm mb-2">
                      {isAr ? 'نظرية فيثاغورس (Pythagorean Theorem)' : 'Pythagorean Theorem'}
                    </h3>
                    <p className="text-xs text-white/80 leading-relaxed mb-3">
                      {isAr
                        ? 'في المثلث القائم الزاوية، مربع طول الوتر يساوي مجموع مربعي طولي الضلعين الآخرين. تستخدم للربط بين أطوال أضلاع المثلث القائم.'
                        : 'In a right-angled triangle, the square of the hypotenuse is equal to the sum of squares of the other two sides.'}
                    </p>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 font-mono text-center text-sm text-[#00E5FF]">
                      a^2 + b^2 = c^2 \implies c = \sqrt{`{a^2 + b^2}`}
                    </div>
                  </div>
                )}

                {activeTheorem === 'area' && (
                  <div>
                    <h3 className="text-[#F59E0B] font-bold text-sm mb-2">
                      {isAr ? 'قانون الجيب والجيب تمام (Law of Sines & Cosines)' : 'Law of Sines & Cosines'}
                    </h3>
                    <p className="text-xs text-white/80 leading-relaxed mb-3">
                      {isAr
                        ? 'تستخدم لحساب أضلاع وزوايا أي مثلث عام بمعلومية بعض الأضلاع أو الزوايا.'
                        : 'Used to calculate unknown sides and angles for any general triangle.'}
                    </p>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 font-mono text-center text-sm text-[#00E5FF] space-y-2">
                      <div>\frac{`{a}`}{`{\sin A}`} = \frac{`{b}`}{`{\sin B}`} = \frac{`{c}`}{`{\sin C}`}</div>
                      <div>c^2 = a^2 + b^2 - 2ab \cos C</div>
                    </div>
                  </div>
                )}

                {activeTheorem === 'thales' && (
                  <div>
                    <h3 className="text-[#F59E0B] font-bold text-sm mb-2">
                      {isAr ? 'نظرية طاليس للتقاطع والتناسب (Thales Theorem)' : 'Thales Theorem'}
                    </h3>
                    <p className="text-xs text-white/80 leading-relaxed mb-3">
                      {isAr
                        ? 'إذا تقاطع خطان مستقيمان مع عدة مستقيمات متوازية، فإن أطوال القطع المستقيمة المتقاطعة تكون متناسبة.'
                        : 'If two lines intersect multiple parallel lines, the corresponding cut segments are proportional.'}
                    </p>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 font-mono text-center text-sm text-[#00E5FF]">
                      \frac{`{AB}`}{`{A'B'}`} = \frac{`{BC}`}{`{B'C'}`} = \frac{`{AC}`}{`{A'C'}`}
                    </div>
                  </div>
                )}

                {activeTheorem === 'circleTheory' && (
                  <div>
                    <h3 className="text-[#F59E0B] font-bold text-sm mb-2">
                      {isAr ? 'قوانين ومعادلات الدائرة (Circle Equations)' : 'Circle Equations'}
                    </h3>
                    <p className="text-xs text-white/80 leading-relaxed mb-3">
                      {isAr
                        ? 'معادلة الدائرة ذات المركز (h, k) ونصف القطر r، بالإضافة للزاوية المركزية والزاوية المحيطية المقابلة لنفس القوس.'
                        : 'Standard circle equation with center (h, k) and radius r, alongside central & inscribed angle properties.'}
                    </p>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 font-mono text-center text-sm text-[#00E5FF] space-y-1">
                      <div>(x - h)^2 + (y - k)^2 = r^2</div>
                      <div className="text-xs text-white/60">{isAr ? 'الزاوية المحيطية = ½ الزاوية المركزية' : 'Inscribed Angle = ½ Central Angle'}</div>
                    </div>
                  </div>
                )}

                {activeTheorem === 'sineLaw' && (
                  <div>
                    <h3 className="text-[#F59E0B] font-bold text-sm mb-2">
                      {isAr ? 'نظرية مجموع زوايا المثلث (Triangle Sum Theorem)' : 'Triangle Angle Sum Theorem'}
                    </h3>
                    <p className="text-xs text-white/80 leading-relaxed mb-3">
                      {isAr
                        ? 'مجموع قياسات الزوايا الداخلية لأي مثلث في الهندسة الإقليدية يساوي دائماً 180 درجة (π rad).'
                        : 'The sum of internal angles of any triangle in Euclidean geometry always equals 180 degrees.'}
                    </p>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 font-mono text-center text-sm text-[#00E5FF]">
                      \angle A + \angle B + \angle C = 180^\circ \quad (\pi \text{ rad})
                    </div>
                  </div>
                )}

                {activeTheorem === 'euclid' && (
                  <div>
                    <h3 className="text-[#F59E0B] font-bold text-sm mb-2">
                      {isAr ? 'مسلمات إقليدس الأساسية (Euclidean Postulates)' : 'Euclidean Postulates'}
                    </h3>
                    <p className="text-xs text-white/80 leading-relaxed mb-3">
                      {isAr
                        ? '1. يمكن رسم خط مستقيم بين أي نقطتين. 2. يمكن مد قطعة مستقيمة إلى ما لا نهاية. 3. يمكن رسم دائرة بأي مركز ونصف قطر.'
                        : 'Fundamental postulates of classical Euclidean geometry connecting points, lines, circles and angles.'}
                    </p>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 font-mono text-center text-xs text-[#00E5FF]">
                      \forall P_1, P_2 \in \mathbb{`{R}`}^2, \exists! \text{ Line } L \text{ connecting } P_1, P_2
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: LaTeX Renderer & Handwriting Annotation */}
          {activeTab === 'latex' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#D946EF] block mb-1">
                  {isAr ? 'أدخل صيغة LaTeX الرياضية (Enter LaTeX Formula):' : 'Enter LaTeX Formula:'}
                </label>
                <input
                  type="text"
                  value={customLatex}
                  onChange={(e) => setCustomLatex(e.target.value)}
                  placeholder="\int_{a}^{b} f(x) \, dx"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-[#D946EF]"
                />
              </div>

              {/* Presets */}
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="text-white/50">{isAr ? 'صيغ جاهزة:' : 'Presets:'}</span>
                <button
                  onClick={() => setCustomLatex('a^2 + b^2 = c^2')}
                  className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[#00E5FF] font-mono border border-white/10"
                >
                  a²+b²=c²
                </button>
                <button
                  onClick={() => setCustomLatex('x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}')}
                  className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[#F59E0B] font-mono border border-white/10"
                >
                  Quadratic Formula
                </button>
                <button
                  onClick={() => setCustomLatex('\\int_{a}^{b} f(x)\\, dx = F(b) - F(a)')}
                  className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[#D946EF] font-mono border border-white/10"
                >
                  Integral
                </button>
              </div>

              {/* Formatted Render Output & Canvas Overlay for Drawing/Annotating on LaTeX */}
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center justify-between w-full px-1">
                  <span className="text-[10px] text-white/60">
                    {isAr ? 'يمكنك الرسم والكتابة فوق المعادلة مباشرة:' : 'Draw & annotate directly on formula:'}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {['#00E5FF', '#F59E0B', '#D946EF', '#FFFFFF'].map((color) => (
                        <button
                          key={color}
                          onClick={() => setDrawColor(color)}
                          className={`w-4 h-4 rounded-full border ${drawColor === color ? 'ring-2 ring-white scale-110' : 'opacity-70'}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <button
                      onClick={clearLatexCanvas}
                      className="text-[10px] bg-white/10 hover:bg-white/20 text-white/80 px-2 py-0.5 rounded-md border border-white/10"
                    >
                      {isAr ? 'مسح الرسم' : 'Clear Drawing'}
                    </button>
                  </div>
                </div>

                <div className="relative w-full bg-black/60 border border-[#D946EF]/40 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[160px] overflow-hidden select-none">
                  {/* LaTeX Equation Display */}
                  <div className="font-mono text-lg text-[#00E5FF] tracking-wider bg-white/5 px-6 py-4 rounded-xl border border-white/10 z-0 shadow-lg pointer-events-none">
                    {customLatex || 'LaTeX expression preview'}
                  </div>

                  {/* Transparent Canvas Overlay for Writing / Annotating on the LaTeX equation */}
                  <canvas
                    ref={latexCanvasRef}
                    width={500}
                    height={160}
                    onMouseDown={startDrawingLatex}
                    onMouseMove={drawOnLatex}
                    onMouseUp={stopDrawingLatex}
                    onMouseLeave={stopDrawingLatex}
                    onTouchStart={startDrawingLatex}
                    onTouchMove={drawOnLatex}
                    onTouchEnd={stopDrawingLatex}
                    className="absolute inset-0 w-full h-full z-10 cursor-crosshair touch-none"
                  />
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
