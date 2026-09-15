import React, { useState, useRef, useEffect } from 'react';

interface StudentPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: string;
}

const DEFAULT_STUDENTS = [
  'أحمد علي',
  'سارة محمد',
  'عمر خالد',
  'مريم يوسف',
  'فاطمة الزهراء',
  'عبد الله حسن',
  'ياسين محمود',
  'نور الهدى',
];

export const StudentPickerModal: React.FC<StudentPickerModalProps> = ({
  isOpen,
  onClose,
  language,
}) => {
  const isAr = language.toLowerCase().startsWith('ar');
  const [students, setStudents] = useState<string[]>(DEFAULT_STUDENTS);
  const [inputText, setInputText] = useState(DEFAULT_STUDENTS.join('\n'));
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);

  // Handwritten input pad state
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const padCanvasRef = useRef<HTMLCanvasElement>(null);
  const wheelCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('smartboard_student_list');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setStudents(parsed);
          setInputText(parsed.join('\n'));
        }
      }
    } catch (e) {
      console.warn('Failed to load student list', e);
    }
  }, []);

  const handleSaveList = (text: string) => {
    setInputText(text);
    const list = text
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    setStudents(list);
    try {
      localStorage.setItem('smartboard_student_list', JSON.stringify(list));
    } catch (e) {
      /* ignore */
    }
  };

  // Draw wheel on canvas
  useEffect(() => {
    if (!wheelCanvasRef.current || students.length === 0) return;
    const canvas = wheelCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 10;

    ctx.clearRect(0, 0, width, height);

    const numSlices = students.length;
    const sliceAngle = (2 * Math.PI) / numSlices;

    const colors = [
      '#00E5FF',
      '#F59E0B',
      '#D946EF',
      '#3B82F6',
      '#8B5CF6',
      '#EC4899',
      '#F97316',
      '#14B8A6',
    ];

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((rotation * Math.PI) / 180);

    students.forEach((student, i) => {
      const startAngle = i * sliceAngle;
      const endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.closePath();

      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      ctx.strokeStyle = '#080D1E';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Slice Text Label
      ctx.save();
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px "IBM Plex Sans Arabic", sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 4;
      ctx.fillText(student, radius - 15, 4);
      ctx.restore();
    });

    ctx.restore();
  }, [students, rotation]);

  // Spin wheel with realistic deceleration physics
  const spinWheel = () => {
    if (isSpinning || students.length === 0) return;
    setIsSpinning(true);
    setSelectedWinner(null);

    const extraSpins = 6 + Math.floor(Math.random() * 4);
    const randomAngle = Math.floor(Math.random() * 360);
    const totalNewRotation = rotation + extraSpins * 360 + randomAngle;

    setRotation(totalNewRotation);

    setTimeout(() => {
      setIsSpinning(false);
      const normalizedAngle = (360 - (totalNewRotation % 360)) % 360;
      const sliceSize = 360 / students.length;
      const winnerIndex = Math.floor(normalizedAngle / sliceSize);
      setSelectedWinner(students[winnerIndex]);
    }, 4500);
  };

  // Handwritten drawing pad methods
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = padCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = padCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.strokeStyle = '#00E5FF';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearHandwrittenCanvas = () => {
    const canvas = padCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const addHandwrittenName = () => {
    const canvas = padCanvasRef.current;
    if (!canvas) return;
    // Simple mock detection label from handwritten stroke
    const newName = `${isAr ? 'طالب برسم اليد' : 'Handwritten'} #${students.length + 1}`;
    const nextList = [...students, newName];
    setStudents(nextList);
    setInputText(nextList.join('\n'));
    clearHandwrittenCanvas();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in font-arabic">
      <div className="bg-[#080D1E] border border-white/10 text-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col md:flex-row">
        {/* Wheel Display Side */}
        <div className="flex-1 p-6 flex flex-col items-center justify-center relative border-b md:border-b-0 md:border-r border-white/10">
          <div className="absolute top-4 z-10 text-[#F59E0B] drop-shadow-md">
            <span className="material-symbols-rounded text-4xl">arrow_drop_down</span>
          </div>

          <div className="relative my-4">
            <canvas
              ref={wheelCanvasRef}
              width={280}
              height={280}
              className="transition-all duration-[4500ms] ease-[cubic-bezier(0.1,0.9,0.2,1)]"
            />
          </div>

          <button
            onClick={spinWheel}
            disabled={isSpinning || students.length === 0}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00E5FF] to-[#D946EF] font-bold text-black text-xs hover:brightness-110 active:scale-95 transition-all shadow-lg disabled:opacity-50"
          >
            {isSpinning
              ? isAr
                ? 'جاري السحب...'
                : 'Spinning...'
              : isAr
              ? '🎲 أدر العجلة الآن'
              : '🎲 Spin the Wheel'}
          </button>

          {selectedWinner && !isSpinning && (
            <div className="mt-4 p-3 bg-[#00E5FF]/20 border border-[#00E5FF]/40 rounded-xl text-center w-full animate-bounce">
              <span className="text-[10px] text-[#00E5FF] block font-semibold">
                {isAr ? 'الطالب المختار:' : 'Selected Student:'}
              </span>
              <span className="text-lg font-bold text-white font-arabic">
                🎉 {selectedWinner}
              </span>
            </div>
          )}
        </div>

        {/* Student List & Handwritten Pad Side */}
        <div className="w-full md:w-72 p-6 bg-white/5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-xs text-[#00E5FF] flex items-center gap-1.5">
                <span className="material-symbols-rounded text-base">groups</span>
                {isAr ? 'قائمة الطلاب' : 'Student List'}
              </h3>
              <button
                onClick={() => setIsDrawingMode(!isDrawingMode)}
                className="text-[10px] bg-white/10 hover:bg-white/20 text-[#F59E0B] px-2 py-1 rounded-lg border border-white/10 flex items-center gap-1"
              >
                <span className="material-symbols-rounded text-xs">gesture</span>
                {isDrawingMode ? (isAr ? 'نص' : 'Text') : (isAr ? 'رسم اليد' : 'Handwritten')}
              </button>
            </div>

            {isDrawingMode ? (
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-white/60">
                  {isAr ? 'اكتب اسم الطالب بخط اليد:' : 'Write student name by hand:'}
                </span>
                <canvas
                  ref={padCanvasRef}
                  width={230}
                  height={120}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="bg-black/50 border border-white/20 rounded-xl cursor-crosshair touch-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={addHandwrittenName}
                    className="flex-1 py-1.5 bg-[#00E5FF] text-black font-bold rounded-lg text-xs"
                  >
                    {isAr ? 'إضافة إلى العجلة' : 'Add to Wheel'}
                  </button>
                  <button
                    onClick={clearHandwrittenCanvas}
                    className="px-2 py-1.5 bg-white/10 text-white/70 rounded-lg text-xs"
                  >
                    {isAr ? 'مسح' : 'Clear'}
                  </button>
                </div>
              </div>
            ) : (
              <textarea
                value={inputText}
                onChange={(e) => handleSaveList(e.target.value)}
                placeholder={isAr ? 'أدخل أسماء الطلاب...' : 'Enter names...'}
                rows={7}
                className="w-full bg-black/30 border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#00E5FF] resize-none font-arabic"
              />
            )}
          </div>

          <button
            onClick={onClose}
            className="mt-4 w-full py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-all border border-white/10"
          >
            {isAr ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentPickerModal;
