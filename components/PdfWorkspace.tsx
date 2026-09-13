import React, { useState, useRef, useCallback, useEffect } from 'react';
import { getDocument, GlobalWorkerOptions, PDFDocumentProxy } from 'pdfjs-dist';
import { parsePdfFile, buildKnowledgeContext } from '../services/knowledge';
import { KnowledgeDoc, PDFPageAnnotation, PDFAnnotation } from '../types';

const WORKER_SRC = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
GlobalWorkerOptions.workerSrc = WORKER_SRC;

interface PdfWorkspaceProps {
  isOpen: boolean;
  onClose: () => void;
  language: string;
  docs: KnowledgeDoc[];
  onDocAdded: (doc: KnowledgeDoc) => void;
  onAsk: (prompt: string, mode?: string) => void;
  onSendPage: (url: string, title: string, x?: number, y?: number) => void;
}

type Tool = 'pan' | 'pen' | 'eraser' | 'note';

const PEN_COLORS = ['#e74c3c', '#2d86f7', '#27ae60', '#e67e22', '#9b59b6', '#1c1b1f'];
const PEN_WIDTHS = [2, 4, 8];

const PdfWorkspace: React.FC<PdfWorkspaceProps> = ({
  isOpen,
  onClose,
  language,
  docs,
  onDocAdded,
  onAsk,
  onSendPage,
}) => {
  const isAr = language.toLowerCase().startsWith('ar');
  const t = (ar: string, en: string) => (isAr ? ar : en);

  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfName, setPdfName] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [canvasUrl, setCanvasUrl] = useState<string>('');
  const [annotations, setAnnotations] = useState<PDFAnnotation[]>([]);
  const [tool, setTool] = useState<Tool>('pan');
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [penWidth, setPenWidth] = useState(PEN_WIDTHS[1]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [drawing, setDrawing] = useState<PDFPageAnnotation | null>(null);
  const [noteDraft, setNoteDraft] = useState<{ x: number; y: number } | null>(null);
  const [showKnowledge, setShowKnowledge] = useState(true);

  const currentAnnotations = useCallback(
    (page: number): PDFPageAnnotation[] =>
      annotations.find(a => a.page === page)?.items || [],
    [annotations]
  );

  const redrawOverlay = (pageNum: number) => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const w = overlay.width || 1;
    const px = (v: number) => v * w;

    const items = [...currentAnnotations(pageNum)];
    if (drawing && drawing.kind === 'pen' && drawing.points?.length) {
      const draft: PDFPageAnnotation = {
        ...drawing,
        color: drawing.color || penColor,
        strokeWidth: drawing.strokeWidth || penWidth,
      };
      items.push(draft);
    }
    for (const item of items) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (item.kind === 'pen' && item.points) {
        ctx.strokeStyle = item.color || PEN_COLORS[0];
        ctx.lineWidth = (item.strokeWidth || PEN_WIDTHS[1]) * (w / 800);
        ctx.beginPath();
        item.points.forEach((p, i) => {
          const x = px(p.x);
          const y = (p.y || 0) * overlay.height;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      } else if (item.kind === 'note' && item.text) {
        const nx = px(item.x || 0);
        const ny = (item.y || 0) * overlay.height;
        ctx.font = `bold ${13 * (w / 800)}px sans-serif`;
        ctx.fillStyle = '#fff9c2';
        ctx.shadowColor = 'rgba(0,0,0,0.25)';
        ctx.shadowBlur = 4;
        const lines = item.text.split('\n');
        const lh = 18 * (w / 800);
        const boxW = Math.min(220, Math.max(...lines.map(l => ctx.measureText(l).width)) + 16) * (w / 800);
        ctx.fillRect(nx, ny, boxW, lines.length * lh + 10);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#1c1b1f';
        lines.forEach((ln, i) => ctx.fillText(ln, nx + 8 * (w / 800), ny + 16 * (w / 800) + i * lh));
      }
    }
  };

  const loadPdf = async (file: File) => {
    setIsParsing(true);
    setProgress(0);
    try {
      const buf = await file.arrayBuffer();
      const pdfDoc = await getDocument({ data: buf }).promise;
      setPdf(pdfDoc);
      setPdfName(file.name);
      setCurrentPage(1);
      await renderPage(pdfDoc, 1);
      const parsed = await parsePdfFile(file, (done, total) => {
        setProgress(Math.round((done / total) * 100));
      });
      onDocAdded({
        id: 'pdf-' + Date.now(),
        name: file.name,
        kind: 'pdf',
        text: parsed.text,
        pages: parsed.pages,
        addedAt: Date.now(),
      });
    } catch (e) {
      console.error('PDF load failed', e);
    } finally {
      setIsParsing(false);
    }
  };

  const renderPage = useCallback(async (pdfDoc: PDFDocumentProxy, pageNum: number) => {
    const page = await pdfDoc.getPage(pageNum);
    const scale = Math.min(1.5, 1600 / page.view[2]);
    const viewport = page.getViewport({ scale });
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas) return;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    if (overlay) {
      overlay.width = viewport.width;
      overlay.height = viewport.height;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    setCanvasUrl(canvas.toDataURL('image/png'));
    redrawOverlay(pageNum);
  }, [redrawOverlay]);

  const goPage = async (delta: number) => {
    if (!pdf) return;
    const next = Math.min(Math.max(1, currentPage + delta), pdf.numPages);
    if (next === currentPage) return;
    setCurrentPage(next);
    setDrawing(null);
    setNoteDraft(null);
    await renderPage(pdf, next);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadPdf(file);
    e.target.value = '';
  };

  // ---- annotation event handling on overlay canvas ----
  const getPos = (e: React.PointerEvent): { x: number; y: number } | null => {
    const overlay = overlayRef.current;
    if (!overlay) return null;
    const rect = overlay.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!pdf) return;
    const pos = getPos(e);
    if (!pos) return;
    if (tool === 'note') {
      setNoteDraft({ x: pos.x, y: pos.y });
      setNoteText('');
    } else if (tool === 'pen' || tool === 'eraser') {
      const drawItem: PDFPageAnnotation = {
        id: 'a-' + Date.now(),
        kind: tool,
        points: [{ x: pos.x, y: pos.y }],
        color: penColor,
        strokeWidth: penWidth,
        text: tool === 'eraser' ? '' : undefined,
      };
      setDrawing(drawItem);
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pdf || !drawing) return;
    const pos = getPos(e);
    if (!pos) return;
    setDrawing(d => (d ? { ...d, points: [...(d.points || []), { x: pos.x, y: pos.y }] } : d));
  };

  const eraseAt = (path: { x: number; y: number }[]) => {
    const radius = 0.04;
    const hit = (p: { x: number; y: number }) =>
      path.some(e =>
        Math.hypot(e.x - p.x, e.y - p.y) <= radius
      );
    setAnnotations(prev =>
      prev.map(a => {
        if (a.page !== currentPage) return a;
        const items = a.items.filter(it => {
          if (it.kind === 'pen' && it.points?.length) {
            return !it.points.some(hit);
          }
          if (it.kind === 'note' && it.x != null && it.y != null) {
            return !hit({ x: it.x, y: it.y });
          }
          return true;
        });
        return { ...a, items };
      }).filter(a => a.items.length > 0)
    );
  };

  const onPointerUp = () => {
    if (!drawing) return;
    const item = drawing;
    if (item.kind === 'eraser') {
      eraseAt(item.points || []);
    } else {
      setAnnotations(prev => {
        const exists = prev.find(a => a.page === currentPage);
        const clean: PDFPageAnnotation = {
          ...item,
          color: item.color || PEN_COLORS[0],
          strokeWidth: item.strokeWidth || PEN_WIDTHS[1],
        };
        if (exists) {
          return prev.map(a =>
            a.page === currentPage ? { ...a, items: [...a.items, clean] } : a
          );
        }
        return [...prev, { id: 'ann-' + Date.now(), page: currentPage, items: [clean] }];
      });
    }
    setDrawing(null);
  };

  const addNote = () => {
    if (!noteDraft || !noteText.trim()) {
      setNoteDraft(null);
      return;
    }
    setAnnotations(prev => {
      const exists = prev.find(a => a.page === currentPage);
      const item: PDFPageAnnotation = {
        id: 'n-' + Date.now(),
        kind: 'note',
        x: noteDraft.x,
        y: noteDraft.y,
        text: noteText.trim(),
      };
      if (exists) {
        return prev.map(a =>
          a.page === currentPage ? { ...a, items: [...a.items, item] } : a
        );
      }
      return [...prev, { id: 'ann-' + Date.now(), page: currentPage, items: [item] }];
    });
    setNoteDraft(null);
    setNoteText('');
  };

  // Keep overlay in sync with (early) draws + draft
  useEffect(() => redrawOverlay(currentPage), [annotations, drawing, currentPage, redrawOverlay]);

  const undoLast = () => {
    setAnnotations(prev =>
      prev
        .map(a => (a.page === currentPage ? { ...a, items: a.items.slice(0, -1) } : a))
        .filter(a => a.items.length > 0)
    );
  };

  const sendPageToBoard = () => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !canvasUrl) return;

    const composite = document.createElement('canvas');
    composite.width = canvas.width;
    composite.height = canvas.height;
    const ctx = composite.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(canvas, 0, 0);
    if (overlay) {
      ctx.drawImage(overlay, 0, 0);
    }
    onSendPage(composite.toDataURL('image/png'), pdfName + ' — p.' + currentPage);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(f => !f);
  };

  const clearAnnotations = () => {
    setAnnotations(prev => [...prev.map(a => (a.page === currentPage ? { ...a, items: [] } : a)).filter(a => a.items.length > 0)]);
  };

  if (!isOpen) return null;

  const toolBtn = (tl: Tool, icon: string, label: string) => (
    <button
      onClick={() => setTool(tl)}
      title={label}
      aria-label={label}
      className={`mat-btn p-2 rounded-xl flex items-center justify-center transition-all ${
        tool === tl ? 'bg-primary text-white shadow-elev-1' : 'text-on-surface/70 hover:bg-surface-variant/70'
      }`}
    >
      <span className="material-symbols-rounded text-xl leading-none">{icon}</span>
    </button>
  );

  return (
    <div
      className={`fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 ${isFullscreen ? 'p-0' : ''}`}
      onClick={onClose}
    >
      <div
        className={`bg-white flex flex-col overflow-hidden shadow-elev-12 ${
          isFullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-6xl h-[88vh] rounded-3xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-2.5 border-b border-black/5 flex items-center justify-between gap-3">
          <h3 className="font-semibold text-on-surface flex items-center gap-2 text-[15px]">
            <span className={`material-symbols-rounded text-red-500 ${isAr ? 'ms-0' : ''}`}>picture_as_pdf</span>
            {pdfName ? pdfName : t('مساحة عمل PDF', 'PDF Workspace')}
          </h3>
          <div className="flex items-center gap-1.5">
            <label className="mat-btn px-3 py-1.5 rounded-lg bg-primary text-white text-sm cursor-pointer hover:shadow-elev-1 transition-all inline-flex items-center gap-1.5">
              <span className="material-symbols-rounded text-lg">add</span>
              {t('فتح PDF', 'Open PDF')}
              <input type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
            </label>
            <button
              onClick={toggleFullscreen}
              className="mat-btn p-1.5 rounded-lg text-on-surface/70 hover:bg-surface-variant/70"
              title={t('ملء الشاشة', isFullscreen ? 'Exit fullscreen' : 'Fullscreen')}
            >
              <span className="material-symbols-rounded text-[20px]">{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
            </button>
            <button
              onClick={onClose}
              className="mat-btn p-1.5 rounded-lg text-on-surface/70 hover:bg-surface-variant/70"
              title={t('إغلاق', 'Close')}
            >
              <span className="material-symbols-rounded text-[20px]">close</span>
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Pages */}
          <div className="flex-1 bg-board flex items-center justify-center overflow-auto p-4 relative">
            {!pdf && (
              <div className="text-center text-on-surface/40">
                <span className="material-symbols-rounded text-6xl text-red-300 block mb-3">picture_as_pdf</span>
                {t('افتح ملف PDF لبدء العمل', 'Open a PDF file to start working')}
              </div>
            )}
            {pdf && (
              <div className="flex flex-col items-center gap-3">
                {isParsing && (
                  <div className="text-xs text-on-surface/60 bg-white rounded-full px-4 py-1 shadow-elev-1">
                    {t('جارٍ استخراج النص...', 'Extracting text...')} {progress}%
                  </div>
                )}

                {/* Toolbar: tools + colors */}
                <div className="bg-white rounded-full shadow-elev-2 px-3 py-1.5 flex items-center gap-1.5 flex-wrap justify-center">
                  {toolBtn('pan', 'pan_tool_alt', t('تحريك', 'Pan'))}
                  {toolBtn('pen', 'draw', t('قلم', 'Pen'))}
                  {toolBtn('eraser', 'ink_eraser', t('ممحاة', 'Eraser'))}
                  {toolBtn('note', 'sticky_note_2', t('ملاحظة', 'Note'))}
                  {tool === 'pen' && (
                    <>
                      <div className="w-px h-5 bg-black/10 mx-0.5" />
                      {PEN_COLORS.map(c => (
                        <button
                          key={c}
                          onClick={() => setPenColor(c)}
                          aria-label={t('لون', 'Color')}
                          className={`w-5 h-5 rounded-full border-2 transition-all ${penColor === c ? 'scale-110 border-primary' : 'border-transparent'}`}
                          style={{ background: c }}
                        />
                      ))}
                      {PEN_WIDTHS.map(w => (
                        <button
                          key={w}
                          onClick={() => setPenWidth(w)}
                          aria-label={t('سمك', 'Width')}
                          className={`mat-btn p-1 rounded-lg flex items-center justify-center ${penWidth === w ? 'bg-tonal' : 'hover:bg-surface-variant/70'}`}
                        >
                          <span className="bg-on-surface rounded-full" style={{ width: w + 1, height: w + 1 }} />
                        </button>
                      ))}
                    </>
                  )}
                  <button
                    onClick={undoLast}
                    disabled={currentAnnotations(currentPage).length === 0}
                    title={t('تراجع', 'Undo')}
                    className="mat-btn p-1.5 rounded-lg text-on-surface/70 hover:bg-surface-variant/70 disabled:opacity-40"
                  >
                    <span className="material-symbols-rounded text-xl">undo</span>
                  </button>
                  <button
                    onClick={clearAnnotations}
                    disabled={currentAnnotations(currentPage).length === 0}
                    title={t('مسح التعليقات', 'Clear annotations')}
                    className="mat-btn p-1.5 rounded-lg text-on-surface/70 hover:bg-surface-variant/70 disabled:opacity-40"
                  >
                    <span className="material-symbols-rounded text-xl">ink_eraser</span>
                  </button>
                </div>

                {/* Page + overlay */}
                <div className="relative shadow-elev-3 rounded-lg bg-white overflow-hidden">
                  <canvas ref={canvasRef} className="block max-w-full max-h-[55vh]" />
                  {pdf && (
                    <canvas
                      ref={overlayRef}
                      className={`absolute inset-0 top-0 left-0 w-full h-full ${tool === 'pan' ? 'pointer-events-none' : 'cursor-crosshair'}`}
                      onPointerDown={onPointerDown}
                      onPointerMove={onPointerMove}
                      onPointerUp={onPointerUp}
                    />
                  )}
                  {noteDraft && (
                    <div
                      className="absolute p-2 bg-yellow-100 rounded-lg shadow-elev-2 flex flex-col gap-1 z-10"
                      style={{ left: `${noteDraft.x * 100}%`, top: `${noteDraft.y * 100}%` }}
                    >
                      <textarea
                        autoFocus
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') addNote(); }}
                        className="text-sm px-2 py-1 rounded border border-black/10 resize-none w-44"
                        rows={2}
                        placeholder={t('اكتب ملاحظة...', 'Write a note...')}
                      />
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setNoteDraft(null)}
                          className="text-xs px-2 py-1 rounded text-on-surface/60 hover:bg-black/5"
                        >
                          {t('إلغاء', 'Cancel')}
                        </button>
                        <button
                          onClick={addNote}
                          className="text-xs px-2 py-1 rounded bg-primary text-white font-medium"
                        >
                          {t('إضافة', 'Add')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Page navigation */}
                <div className="flex items-center gap-3 text-sm">
                  <button
                    onClick={() => goPage(-1)}
                    disabled={currentPage <= 1}
                    className="mat-btn p-2 rounded-lg bg-white text-on-surface/80 shadow-elev-1 hover:shadow-elev-2 disabled:opacity-40 flex items-center justify-center"
                    title={t('السابق', 'Previous')}
                  >
                    <span className="material-symbols-rounded text-lg">{isAr ? 'chevron_right' : 'chevron_left'}</span>
                  </button>
                  <span className="font-medium text-on-surface/80">
                    {currentPage} / {pdf.numPages}
                  </span>
                  <button
                    onClick={() => goPage(1)}
                    disabled={currentPage >= pdf.numPages}
                    className="mat-btn p-2 rounded-lg bg-white text-on-surface/80 shadow-elev-1 hover:shadow-elev-2 disabled:opacity-40 flex items-center justify-center"
                    title={t('التالي', 'Next')}
                  >
                    <span className="material-symbols-rounded text-lg">{isAr ? 'chevron_left' : 'chevron_right'}</span>
                  </button>
                  <button
                    onClick={sendPageToBoard}
                    disabled={!canvasUrl}
                    className="mat-btn px-4 py-2 rounded-full bg-secondary text-white text-sm font-medium hover:shadow-elev-2 disabled:opacity-40 inline-flex items-center gap-2 transition-all"
                  >
                    <span className="material-symbols-rounded text-lg">send_to_board</span>
                    {t('إرسال الصفحة إلى السبورة', 'Send page to whiteboard')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Knowledge panel */}
          <div className={`${showKnowledge ? 'w-72' : 'w-10'} border-l border-black/5 flex flex-col bg-white transition-all`}>
            <button
              onClick={() => setShowKnowledge(v => !v)}
              className="px-3 py-2.5 border-b border-black/5 flex items-center gap-2 text-on-surface/80 hover:bg-surface-variant/40 text-sm font-medium"
              title={t('مصادر المعرفة', 'Knowledge sources')}
            >
              <span className="material-symbols-rounded text-primary">{showKnowledge ? 'chevron_right' : 'menu_book'}</span>
              {showKnowledge && t('مصادر المعرفة', 'Knowledge sources')}
            </button>
            {showKnowledge && (
              <>
                <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm scroll-thin">
                  {docs.length === 0 && (
                    <p className="text-on-surface/40 text-xs">{t('لم تُضف مصادر بعد. افتح ملف PDF وسيُضاف تلقائيًا.', 'No sources yet. Open a PDF and it will be added automatically.')}</p>
                  )}
                  {docs.map((doc) => (
                    <div key={doc.id} className="p-2 rounded-xl bg-surface-variant/40 border border-black/5">
                      <p className="font-medium text-on-surface truncate flex items-center gap-1.5">
                        <span className="material-symbols-rounded text-red-400 text-base">picture_as_pdf</span>
                        {doc.name}
                      </p>
                      <p className="text-xs text-on-surface/40 mt-1">{doc.pages ?? 0} {t('صفحة', 'pages')} · {doc.text.length} {t('حرف', 'chars')}</p>
                    </div>
                  ))}
                </div>
                <div className="p-2.5 border-t border-black/5 space-y-2">
                  <button
                    onClick={() => onAsk(buildKnowledgeContext('', docs) + '\n' + t('لخّص المستند', 'Summarize the document'), 'summarize')}
                    disabled={docs.length === 0}
                    className="w-full px-3 py-2 rounded-lg bg-surface-variant/50 text-on-surface/80 text-sm hover:bg-tonal disabled:opacity-40 inline-flex items-center gap-2 transition-all"
                  >
                    <span className="material-symbols-rounded text-lg">summarize</span>{t('لخّص المستند', 'Summarize')}
                  </button>
                  <button
                    onClick={() => onAsk(buildKnowledgeContext('', docs) + '\n' + t('اشرح هذا المستند للطلاب', 'Explain this document to students'), 'explain')}
                    disabled={docs.length === 0}
                    className="w-full px-3 py-2 rounded-lg bg-surface-variant/50 text-on-surface/80 text-sm hover:bg-tonal disabled:opacity-40 inline-flex items-center gap-2 transition-all"
                  >
                    <span className="material-symbols-rounded text-lg">school</span>{t('اشرح للطلاب', 'Explain to students')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PdfWorkspace;