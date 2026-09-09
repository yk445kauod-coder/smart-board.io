import React, { useState, useRef, useCallback } from 'react';
import { getDocument, GlobalWorkerOptions, PDFDocumentProxy } from 'pdfjs-dist';
import type { PDFPageProxy } from 'pdfjs-dist';
import { parsePdfFile, buildKnowledgeContext } from '../services/knowledge';
import { KnowledgeDoc } from '../types';

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
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [pdfName, setPdfName] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasUrl, setCanvasUrl] = useState<string>('');

  const loadPdf = async (file: File) => {
    setIsParsing(true);
    setProgress(0);
    try {
      const buf = await file.arrayBuffer();
      const pdf = await getDocument({ data: buf }).promise;
      setPdf(pdf);
      setPdfName(file.name);
      setCurrentPage(1);
      await renderPage(pdf, 1);
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

  const renderPage = useCallback(async (pdf: PDFDocumentProxy, pageNum: number) => {
    const page = await pdf.getPage(pageNum);
    const base = Math.min(1.5, 1600 / page.view[2]);
    const viewport = page.getViewport({ scale: base });
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    const url = canvas.toDataURL('image/png');
    setCanvasUrl(url);
  }, []);

  const goPage = async (delta: number) => {
    if (!pdf) return;
    const next = Math.min(Math.max(1, currentPage + delta), pdf.numPages);
    if (next === currentPage) return;
    setCurrentPage(next);
    await renderPage(pdf, next);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadPdf(file);
    e.target.value = '';
  };

  const sendPageToBoard = () => {
    if (!canvasUrl) return;
    onSendPage(canvasUrl, pdfName + ' — p.' + currentPage, (Math.random() * 300, Math.random() * 200));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between gap-4 bg-gray-50">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <i className="fa-solid fa-file-pdf text-red-500"></i>
            {t('مساحة عمل PDF', 'PDF Workspace')}
          </h3>
          <div className="flex items-center gap-3">
            <label className="text-sm px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer">
              <i className="fa-solid fa-upload mr-1"></i>
              {t('فتح PDF', 'Open PDF')}
              <input type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
            </label>
            <button onClick={onClose} className="p-2 rounded-lg text-gray-500 hover:bg-gray-200" title={t('إغلاق', 'Close')}><i className="fa-solid fa-xmark"></i></button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Pages */}
          <div className="flex-1 bg-gray-100 flex items-center justify-center overflow-auto p-4">
            {!pdf && (
              <div className="text-center text-gray-400">
                <i className="fa-solid fa-file-pdf text-6xl text-red-300 block mb-3"></i>
                {t('افتح ملف PDF لبدء العمل', 'Open a PDF file to start working')}
              </div>
            )}
            {pdf && (
              <div className="flex flex-col items-center gap-3">
                {isParsing && (
                  <div className="text-xs text-gray-500 bg-white rounded-full px-4 py-1 shadow">
                    {t('جارٍ استخراج النص...', 'Extracting text...')} {progress}%
                  </div>
                )}
                <canvas ref={canvasRef} className="max-w-full max-h-[58vh] shadow-xl rounded-lg bg-white" />
                <div className="flex items-center gap-3 text-sm">
                  <button onClick={() => goPage(-1)} disabled={currentPage <= 1} className="px-3 py-1 rounded-lg bg-gray-200 hover:bg-gray-300 disabled:opacity-40"><i className="fa-solid fa-chevron-right"></i></button>
                  <span className="font-medium text-gray-700">{currentPage} / {pdf.numPages}</span>
                  <button onClick={() => goPage(1)} disabled={currentPage >= pdf.numPages} className="px-3 py-1 rounded-lg bg-gray-200 hover:bg-gray-300 disabled:opacity-40"><i className="fa-solid fa-chevron-left"></i></button>
                </div>
                <button onClick={sendPageToBoard} disabled={!canvasUrl} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 shadow">
                  <i className="fa-solid fa-arrow-right-to-bracket mr-1"></i>
                  {t('إرسال الصفحة إلى السبورة', 'Send page to whiteboard')}
                </button>
              </div>
            )}
          </div>

          {/* Knowledge panel */}
          <div className="w-72 border-l border-gray-200 flex flex-col bg-white">
            <div className="px-4 py-3 border-b border-gray-100 font-medium text-gray-700 text-sm">
              <i className="fa-solid fa-database mr-1 text-indigo-500"></i>
              {t('مصادر المعرفة', 'Knowledge sources')}
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm">
              {docs.length === 0 && (
                <p className="text-gray-400 text-xs">{t('لم تُضف مصادر بعد. افتح ملف PDF وسيُضاف تلقائيًا.', 'No sources yet. Open a PDF and it will be added automatically.')}</p>
              )}
              {docs.map((doc) => (
                <div key={doc.id} className="p-2 rounded-lg bg-gray-50 border border-gray-200">
                  <p className="font-medium text-gray-700 truncate"><i className="fa-solid fa-file-pdf text-red-400 mr-1"></i>{doc.name}</p>
                  <p className="text-xs text-gray-400 mt-1">{doc.pages ?? 0} {t('صفحة', 'pages')} · {doc.text.length} {t('حرف', 'chars')}</p>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-gray-100 space-y-2">
              <button
                onClick={() => onAsk(buildKnowledgeContext('', docs) + '\n' + t('لخّص المستند', 'Summarize the document'), 'summarize')}
                disabled={docs.length === 0}
                className="w-full px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm hover:bg-indigo-100 disabled:opacity-40"
              >
                <i className="fa-solid fa-list-check mr-1"></i>{t('لخّص المستند', 'Summarize')}
              </button>
              <button
                onClick={() => onAsk(buildKnowledgeContext('', docs) + '\n' + t('اشرح هذا المستند للطلاب', 'Explain this document to students'), 'explain')}
                disabled={docs.length === 0}
                className="w-full px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm hover:bg-indigo-100 disabled:opacity-40"
              >
                <i className="fa-solid fa-chalkboard-user mr-1"></i>{t('اشرح للطلاب', 'Explain to students')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PdfWorkspace;