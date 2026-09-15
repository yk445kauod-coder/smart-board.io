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
  'كريم إبراهيم',
  'سلمى طارق',
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

  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  // Draw the wheel on canvas
  useEffect(() => {
    if (!canvasRef.current || students.length === 0) return;
    const canvas = canvasRef.current;
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
      '#10B981',
      '#8B5CF6',
      '#EC4899',
      '#3B82F6',
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
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Text label
      ctx.save();
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px "IBM Plex Sans Arabic", sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4;
      ctx.fillText(student, radius - 20, 5);
      ctx.restore();
    });

    ctx.restore();
  }, [students, rotation]);

  const spinWheel = () => {
    if (isSpinning || students.length === 0) return;
    setIsSpinning(true);
    setSelectedWinner(null);

    const extraSpins = 5 + Math.floor(Math.random() * 5);
    const randomAngle = Math.floor(Math.random() * 360);
    const totalNewRotation = rotation + extraSpins * 360 + randomAngle;

    setRotation(totalNewRotation);

    setTimeout(() => {
      setIsSpinning(false);
      const normalizedAngle = (360 - (totalNewRotation % 360)) % 360;
      const sliceSize = 360 / students.length;
      const winnerIndex = Math.floor(normalizedAngle / sliceSize);
      setSelectedWinner(students[winnerIndex]);
    }, 4000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-[#080D1E] border border-white/10 text-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col md:flex-row">
        {/* Wheel Display Side */}
        <div className="flex-1 p-6 flex flex-col items-center justify-center relative border-b md:border-b-0 md:border-r border-white/10">
          {/* Top Indicator Pointer */}
          <div className="absolute top-4 z-10 text-[#F59E0B] drop-shadow-md">
            <span className="material-symbols-rounded text-4xl">arrow_drop_down</span>
          </div>

          <div className="relative my-4">
            <canvas
              ref={canvasRef}
              width={280}
              height={280}
              className="transition-all duration-[4000ms] ease-[cubic-bezier(0.15,0.9,0.25,1)]"
            />
          </div>

          <button
            onClick={spinWheel}
            disabled={isSpinning || students.length === 0}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00E5FF] to-emerald-400 font-bold text-black text-sm hover:brightness-110 active:scale-95 transition-all shadow-lg disabled:opacity-50"
          >
            {isSpinning
              ? isAr
                ? 'جاري السحب...'
                : 'Spinning...'
              : isAr
              ? '🎲 أدر العجلة الآن'
              : '🎲 Spin the Wheel'}
          </button>

          {/* Winner Announcement Card */}
          {selectedWinner && !isSpinning && (
            <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-center w-full animate-bounce">
              <span className="text-xs text-emerald-400 block font-semibold">
                {isAr ? 'الطالب الفائز بالمشاركة:' : 'Selected Student:'}
              </span>
              <span className="text-xl font-bold text-white font-arabic">
                🎉 {selectedWinner}
              </span>
            </div>
          )}
        </div>

        {/* Student List Edit Side */}
        <div className="w-full md:w-64 p-6 bg-white/5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm text-[#00E5FF] flex items-center gap-1.5 font-arabic">
                <span className="material-symbols-rounded text-base">groups</span>
                {isAr ? 'قائمة الطلاب' : 'Student List'}
              </h3>
              <span className="text-xs text-white/50 font-numbers">{students.length}</span>
            </div>

            <textarea
              value={inputText}
              onChange={(e) => handleSaveList(e.target.value)}
              placeholder={isAr ? 'أدخل أسماء الطلاب (اسم في كل سطر)...' : 'Enter names...'}
              rows={8}
              className="w-full bg-black/30 border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#00E5FF] resize-none font-arabic"
            />
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
