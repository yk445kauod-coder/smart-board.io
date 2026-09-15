import React, { useState } from 'react';

interface ScientificCalcModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: string;
}

export const ScientificCalcModal: React.FC<ScientificCalcModalProps> = ({
  isOpen,
  onClose,
  language,
}) => {
  const isAr = language.toLowerCase().startsWith('ar');
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState<string | null>(null);

  // Unit converter state
  const [convertVal, setConvertVal] = useState('1');
  const [convertType, setConvertType] = useState<'len' | 'mass' | 'temp'>('len');
  const [convertedResult, setConvertedResult] = useState<string>('100 cm');

  const handleAppend = (val: string) => {
    setExpression((prev) => prev + val);
  };

  const handleClear = () => {
    setExpression('');
    setResult(null);
  };

  const handleCalculate = () => {
    try {
      // Safe scientific math evaluation
      let expr = expression
        .replace(/sin/g, 'Math.sin')
        .replace(/cos/g, 'Math.cos')
        .replace(/tan/g, 'Math.tan')
        .replace(/sqrt/g, 'Math.sqrt')
        .replace(/π/g, 'Math.PI')
        .replace(/\^/g, '**');

      const evalRes = Function(`'use strict'; return (${expr})`)();
      setResult(String(evalRes));
    } catch (e) {
      setResult(isAr ? 'خطأ في المعادلة' : 'Error');
    }
  };

  const handleConvert = () => {
    const num = parseFloat(convertVal) || 0;
    if (convertType === 'len') {
      setConvertedResult(`${num} m = ${(num * 100).toFixed(2)} cm = ${(num * 1000).toFixed(2)} mm`);
    } else if (convertType === 'mass') {
      setConvertedResult(`${num} kg = ${(num * 1000).toFixed(2)} g`);
    } else if (convertType === 'temp') {
      setConvertedResult(`${num} °C = ${(num * 1.8 + 32).toFixed(2)} °F = ${(num + 273.15).toFixed(2)} K`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-[#080D1E] border border-white/10 text-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-rounded text-xl text-[#00E5FF]">calculate</span>
            <h3 className="font-bold text-sm text-[#00E5FF] font-arabic">
              {isAr ? 'حاسبة المعادلات والتحويلات العلمية' : 'Scientific Calculator'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-all"
          >
            <span className="material-symbols-rounded text-lg">close</span>
          </button>
        </div>

        {/* Display Screen */}
        <div className="p-6 bg-black/40 border-b border-white/10 flex flex-col items-end justify-center min-h-[100px] font-numbers">
          <span className="text-sm text-white/50 tracking-wider overflow-x-auto max-w-full">
            {expression || '0'}
          </span>
          <span className="text-2xl font-bold text-[#00E5FF] tracking-wider mt-1">
            {result !== null ? `= ${result}` : ''}
          </span>
        </div>

        {/* Keypad Buttons */}
        <div className="p-6 grid grid-cols-5 gap-2 bg-white/5">
          {['sin', 'cos', 'tan', 'sqrt', '^'].map((btn) => (
            <button
              key={btn}
              onClick={() => handleAppend(btn === 'sqrt' ? 'sqrt(' : `${btn}(`)}
              className="py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold font-mono text-[#00E5FF] transition-all"
            >
              {btn}
            </button>
          ))}

          {['7', '8', '9', '/', 'C'].map((btn) => (
            <button
              key={btn}
              onClick={() => (btn === 'C' ? handleClear() : handleAppend(btn))}
              className={`py-3 rounded-xl font-bold font-numbers text-sm transition-all ${
                btn === 'C'
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              {btn}
            </button>
          ))}

          {['4', '5', '6', '*', '('].map((btn) => (
            <button
              key={btn}
              onClick={() => handleAppend(btn)}
              className="py-3 rounded-xl bg-white/10 hover:bg-white/20 font-bold font-numbers text-sm text-white transition-all"
            >
              {btn}
            </button>
          ))}

          {['1', '2', '3', '-', ')'].map((btn) => (
            <button
              key={btn}
              onClick={() => handleAppend(btn)}
              className="py-3 rounded-xl bg-white/10 hover:bg-white/20 font-bold font-numbers text-sm text-white transition-all"
            >
              {btn}
            </button>
          ))}

          {['0', '.', 'π', '+', '='].map((btn) => (
            <button
              key={btn}
              onClick={() => (btn === '=' ? handleCalculate() : handleAppend(btn))}
              className={`py-3 rounded-xl font-bold font-numbers text-sm transition-all ${
                btn === '='
                  ? 'bg-gradient-to-r from-[#00E5FF] to-emerald-400 text-black font-extrabold'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              {btn}
            </button>
          ))}
        </div>

        {/* Quick Scientific Unit Converter */}
        <div className="p-4 bg-black/30 border-t border-white/10 flex flex-col gap-2">
          <span className="text-xs font-semibold text-white/60 font-arabic">
            {isAr ? 'محول الوحدات العلمية السريع:' : 'Quick Unit Converter:'}
          </span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={convertVal}
              onChange={(e) => setConvertVal(e.target.value)}
              className="w-20 bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-numbers"
            />
            <select
              value={convertType}
              onChange={(e) => setConvertType(e.target.value as any)}
              className="bg-[#080D1E] border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-arabic"
            >
              <option value="len">{isAr ? 'الطول (m)' : 'Length (m)'}</option>
              <option value="mass">{isAr ? 'الكتلة (kg)' : 'Mass (kg)'}</option>
              <option value="temp">{isAr ? 'الحرارة (°C)' : 'Temperature (°C)'}</option>
            </select>
            <button
              onClick={handleConvert}
              className="px-3 py-1 bg-[#00E5FF] text-black rounded-lg text-xs font-bold font-arabic hover:brightness-110"
            >
              {isAr ? 'حَوّل' : 'Convert'}
            </button>
          </div>
          <span className="text-xs text-[#00E5FF] font-mono font-semibold mt-1">
            {convertedResult}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ScientificCalcModal;
