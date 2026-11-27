import type { ProtocolScript } from './types';
import { validateScript, type ValidateOptions } from './validate';

export interface ParseResult {
  script: ProtocolScript | null;
  errors: string[];
  raw: string;
}

export function stripCodeFence(text: string): string {
  const t = (text || '').trim();
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (m ? m[1] : t).trim();
}

export function extractJsonObject(text: string): string | null {
  const t = stripCodeFence(text);
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  return t.slice(start, end + 1);
}

/**
 * Parses a full model response. Tolerates prose around the JSON object and
 * ```json fences. Returns the parsed script even when individual ops are
 * invalid, so the UI can render the valid prefix and report the rest.
 */
export function parseProtocolScript(text: string, options: ValidateOptions = {}): ParseResult {
  const raw = text || '';
  const json = extractJsonObject(raw);
  if (!json) return { script: null, errors: ['no JSON object found'], raw };
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    return { script: null, errors: [`JSON parse error: ${(err as Error).message}`], raw };
  }
  const errors = validateScript(parsed, options);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as Record<string, unknown>).steps)) {
    return { script: null, errors, raw };
  }
  return { script: parsed as ProtocolScript, errors, raw };
}
