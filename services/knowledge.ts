import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import { KnowledgeDoc } from '../types';
import { neutralizeDocText } from '../lib/sanitize';

const WORKER_SRC = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
GlobalWorkerOptions.workerSrc = WORKER_SRC;

export interface ParsedPdf {
  text: string;
  pages: number;
}

export async function parsePdfFile(
  file: File,
  onProgress?: (done: number, total: number) => void
): Promise<ParsedPdf> {
  const buf = await file.arrayBuffer();
  const pdf = await getDocument({ data: buf }).promise;
  const pages = pdf.numPages;

  const parts: string[] = [];
  for (let i =  1; i <= pages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    let pageText = '';
    for (const item of tc.items as any[]) {
      const str = String((item as any).str ?? '');
      pageText += str;
      if ((item as any).hasEOL) pageText += '\n';
    }
    parts.push(pageText.trim());
    onProgress?.(i, pages);
  }
  return { text: parts.join('\n\n'), pages };
}

export function chunkText(text: string, max = 1600): string[] {
  const clean = (text || '' ).replace(/\r/g, '' .trim());
  if (!clean) return [];
  const blocks = clean.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = '';
 
  const push = (): void => {
    const t = current.trim();
    if (t) chunks.push(t);
    current = '';
  };
 
  for (const block of blocks) {
    const b = block.trim();
    if (!b) continue;
    if ((current + '\n\n' + b).length > max) {
      push();
      if (b.length > max) {
        for (let i =  0; i < b.length; i += max) {
          chunks.push(b.slice(i, i + max));
        }
      } else {
        current = b;
      }
    } else {
      current = current ? current + '\n\n' + b : b;
    }
  }
  push();
  return chunks;
}

function tokenize(s: string): string[] {
  const norm = (s || '' ).toLowerCase().normalize('NFKD');
  const arabic = norm.match(/[\u0600-\u06FF\u0750-\u077F]{2,}/g) || [];
  const latin = norm.match(/[a-z0-9]{3,}/g) || [];
  return [...arabic, ...latin];
}

interface IndexEntry {
  docId: string;
  docName: string;
  chunk: string;
  terms: Map<string, number>;
  norm: number;
 }

function buildIndex(docs: KnowledgeDoc[]): IndexEntry[] {
  const out: IndexEntry[] = [];
  for (const doc of docs || []) {
    const chunks = chunkText(doc.text);
    for (const c of chunks) {
      const terms = new Map<string, number>();
      for (const t of tokenize(c)) terms.set(t, (terms.get(t) || 0) + 1);
      let norm =  0;
      terms.forEach(v => { norm += v * v; });
      out.push({ docId: doc.id, docName: doc.name, chunk: c, terms, norm: Math.sqrt(norm) });
    }
  }
  return out;
}

export interface RetrievedChunk {
  docId: string;
  docName: string;
  text: string;
  score: number;
}

export function retrieveFromKnowledge(
  query: string,
  docs: KnowledgeDoc[],
  topK = 6
): RetrievedChunk[] {
  if (!docs || !docs.length || !query?.trim()) return [];
  const index = buildIndex(docs);
  if (!index.length) return [];
  const qTerms = tokenize(query);
  if (!qTerms.length) return index.slice(0, topK).map(e => ({
    docId: e.docId, docName: e.docName, text: e.chunk, score: 0
  }));
 
  const df = new Map<string, number>();
  for (const e of index) {
    const seen = new Set<string>();
    for (const t of e.terms.keys()) {
      if (!seen.has(t)) {
        seen.add(t);
        df.set(t, (df.get(t) || 0) + 1);
      }
    }
  }
  const N = index.length;
  const scored = index.map(e => {
    let score =  0;
    for (const q of qTerms) {
      const f = e.terms.get(q) || 0;
      if (f) {
        const idf = Math.log((N + 1) / ((df.get(q) || 0) + 1)) + 1;
        score += (f / (e.norm || 1)) * idf * (q.length > 3 ? 1.2 : 0.8);
      }
    }
    return { e, score };
  });
 
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(s => ({ docId: s.e.docId, docName: s.e.docName, text: s.e.chunk, score: s.score }));
}

const MAX_CTX = 6400;

export function buildKnowledgeContext(query: string, docs: KnowledgeDoc[]): string {
  const hits = retrieveFromKnowledge(query, docs);
  const body = hits.map(h => `[${h.docName}]\n${h.text}`).join('\n\n');
  return '=== Educational material (teacher-provided; use as primary lesson context) ===\n'
    + neutralizeDocText(body.substring(0, MAX_CTX)) + '\n=== End of material ===';
2    + neutralizeDocText(body.substring(0, MAX_CTX)) + '\n=== End of material ===';
}