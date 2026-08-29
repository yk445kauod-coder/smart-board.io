import type { BoardAction } from '../../../types';

// Strips markdown fences and trims stray prose around a JSON payload..
export const cleanupJsonMarkers = (text: string): string => {
  const raw = (text || '');
  const tr = raw.trim();
  const fenced = tr.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  return tr;
};

export const extractJsonArray = (text: string): unknown[] | null => {
  if (!text) return null;
  const cleaned = cleanupJsonMarkers(text);
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start !== -1 && end > start) {
    try {
      const sliced = cleaned.slice(start, end + 1);
      const parsed = JSON.parse(sliced);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // ignore
    }
  }
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && 'object') {
      const obj = parsed as any;
      if (Array.isArray(obj.commands)) return obj.commands;
      if (Array.isArray(obj.elements)) return obj.elements;
    }
  } catch {
    // ignore
  }
  return null;
};

export const isPlainResponseMode = (mode: string): boolean => {
  const list = ['explain', 'simplify', 'summarize', 'expand', 'questions', 'translate', 'solve'];
  return list.includes(mode);
};