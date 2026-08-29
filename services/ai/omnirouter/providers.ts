import type { BoardAction, LessonRequest } from '../../../types';
import { buildOfflineLesson } from './offlineLesson';
import { cleanupJsonMarkers, extractJsonArray, isPlainResponseMode } from './validate';

export interface ProviderResult {
  text: string;
  model: string;
  provider: string;
  raw?: unknown;
}

export interface TextProvider {
  id: string;
  name: string;
  // Attempts a completion; resolve null to signal "skip me/not applicable",
  complete(req: LessonRequest, system: string, user: string): Promise<ProviderResult | null>;
}

// ---------------------------------------------------------------- Gemini (REST, OpenAI-compatible)
// Uses a teacher-supplied Google AI Studio key (free tier: 1.5k req/day). Resolved at runtime from settings, never bundled in source.

export const geminiProvider: TextProvider = {
  id: 'gemini',
  name: 'Gemini (Google AI Studio free)',
  async complete(req, system, user) {
    const apiKey = typeof window !== 'undefined' ? (window as any).__SMARTBOARD_AI_KEY__ : undefined;
    if (!apiKey) return null;

    const model = req.context?.pdfText ? 'gemini-2.5-flash' : 'gemini-2.5-flash';
    const body = {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.5,
      response_format: { type: 'json_object' },
      max_tokens: 4096,
    };

    try {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || `Gemini HTTP ${res.status}`);
      const text = data?.choices?.[0]?.message?.content;
      if (!text) throw new Error('Gemini returned empty content');
      return { text, model: data?.model || model, provider: 'gemini' };
    } catch (e) {
      console.warn('[ai] Gemini failed:', (e as Error).message);
      throw e;
    }
  },
};

// ---------------------------------------------------------- Pollinations legacy GET (anonymous, free)
// Plain-text GET endpoint; works anonymously. JSON is requested via "json=true" where supported.
// NOTE: as of the research, anonymous POST chat completions are budget-gated (402), so we use the GET
// fallback for simple/fallback paths only (it ignores response_format; we then chip JSON out of text).
//
export const pollinationsProvider: TextProvider = {
  id: 'pollinations',
  name: 'Pollinations (free GET)',
  async complete(req, system, user) {
    // Quick sanity: legacy GET only makes sense for short, plain text requests
    const flatPrompt = `${system}\n\n${user}`.substring(0, 1400);
    const seed = Math.floor(Math.random() * 100000000);
    const url = `https://text.pollinations.ai/${encodeURIComponent(flatPrompt)}?model=openai&seed=${seed}&json=true`;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 45000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`Pollinations HTTP ${res.status}`);
      const text = (await res.text()).trim();
      if (!text) throw new Error('Pollinations empty');
      return { text, model: 'pollinations-openai', provider: 'pollinations' };
    } catch (e) {
      console.warn('[ai] Pollinations failed:', (e as Error).message);
      throw e;
    }
  },
};

// ---------------------------------------------------------- OmniRouter-compatible gateway (configurable)
// Points at any OpenAI-compatible router endpoint (self-hosted OmniRouter, OpenRouter, LiteLLM, etc..
// Credentials resolved from settings, never bundled in source.

export const omnirouterProvider: TextProvider = {
  id: 'omnirouter',
  name: 'OmniRouter-compatible gateway',
  async complete(req, system, user) {
    const cfg = typeof window !== 'undefined' ? (window as any).__SMARTBOARD_OMNI_CFG__ : undefined;
    const baseUrl = cfg?.baseUrl || '';
    const apiKey = cfg?.apiKey || '';
    const model = cfg?.model || 'openai';
    if (!baseUrl) return null;
    try {
      const body = {
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.5,
        max_tokens: 4096,
      };
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || `Gateway HTTP ${res.status}`);
      const text = data?.choices?.[0]?.message?.content;
      if (!text) throw new Error('Gateway returned empty content');
      return { text, model: data?.model || model, provider: 'omnirouter' };
    } catch (e) {
      console.warn('[ai] OmniRouter gateway failed:', (e as Error).message);
      throw e;
    }
  },
};

// ---------------------------------------------------------- Offline deterministic builder (always works)
export const offlineProvider: TextProvider = {
  id: 'offline',
  name: 'Offline lesson builder (no network)',
  async complete(req, _system, _user) {
    const actions = buildOfflineLesson(req);
    return {
      text: JSON.stringify(actions),
      model: 'offline-deterministic',
      provider: 'offline',
    };
  },
};

export const PROVIDERS: TextProvider[] = [
  omnirouterProvider,
  geminiProvider,
  pollinationsProvider,
  offlineProvider,
];

// Convenience helper for tests.
export const textToBoardCommands = (text: string): BoardAction[] => {
  const cleaned = cleanupJsonMarkers(text);
  const arr = extractJsonArray(cleaned);
  if (arr) {
    return arr as BoardAction[];
  }
  // Try wrapping a lone object brace/fallback
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed as BoardAction[];
    if (parsed && typeof parsed === 'object' && (parsed as any).commands) return (parsed as any).commands as BoardAction[];
  } catch (e) { /* ignore */ }
  return [];
};