export interface VectorMemoryEntry {
  id: string;
  text: string;
  category: 'lesson' | 'doc' | 'qa' | 'teacher_note';
  vector: number[];
  timestamp: number;
  metadata?: Record<string, unknown>;
}

const STORAGE_KEY = 'smartboard_vector_memory';
const VOCAB_SIZE = 128;

// Deterministic hashing helper to project text into a fixed VOCAB_SIZE vector space
function textToVector(text: string): number[] {
  const vec = new Array(VOCAB_SIZE).fill(0);
  const words = text.toLowerCase().replace(/[^\w\u0600-\u06FF\s]/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 0) return vec;

  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash << 5) - hash + word.charCodeAt(i);
      hash |= 0;
    }
    const index = Math.abs(hash) % VOCAB_SIZE;
    vec[index] += 1;
  }

  // Normalize vector to unit length
  let norm = 0;
  for (let i = 0; i < VOCAB_SIZE; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < VOCAB_SIZE; i++) vec[i] /= norm;
  }
  return vec;
}

function cosineSimilarity(v1: number[], v2: number[]): number {
  if (v1.length !== v2.length) return 0;
  let dot = 0;
  let norm1 = 0;
  let norm2 = 0;
  for (let i = 0; i < v1.length; i++) {
    dot += v1[i] * v2[i];
    norm1 += v1[i] * v1[i];
    norm2 += v2[i] * v2[i];
  }
  if (norm1 === 0 || norm2 === 0) return 0;
  return dot / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

// Load all stored vector memories from LocalStorage
export function loadVectorMemories(): VectorMemoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as VectorMemoryEntry[];
  } catch (e) {
    console.warn('Failed to load vector memory:', e);
    return [];
  }
}

// Store a new text entry into the vector memory
export function storeMemory(text: string, category: VectorMemoryEntry['category'] = 'qa', metadata?: Record<string, unknown>): VectorMemoryEntry {
  const clean = text.trim();
  if (!clean) throw new Error('Cannot store empty memory');

  const memories = loadVectorMemories();
  // Check if identical memory already exists
  const existing = memories.find(m => m.text.toLowerCase() === clean.toLowerCase());
  if (existing) return existing;

  const entry: VectorMemoryEntry = {
    id: 'mem-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    text: clean,
    category,
    vector: textToVector(clean),
    timestamp: Date.now(),
    metadata,
  };

  const next = [...memories, entry].slice(-200); // retain up to 200 vector memory entries
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    console.warn('Failed to persist vector memory:', e);
  }
  return entry;
}

// Query the vector memory and return top K most relevant memories using cosine similarity
export function recallRelevantMemories(query: string, topK = 4, minSimilarity = 0.15): VectorMemoryEntry[] {
  const queryVec = textToVector(query);
  const memories = loadVectorMemories();
  if (memories.length === 0) return [];

  const scored = memories.map(m => ({
    entry: m,
    score: cosineSimilarity(queryVec, m.vector),
  })).filter(x => x.score >= minSimilarity);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map(x => x.entry);
}

// Clear all vector memory entries
export function clearVectorMemory(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear vector memory:', e);
  }
}
