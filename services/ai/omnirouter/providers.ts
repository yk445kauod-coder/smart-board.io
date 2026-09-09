import type { BoardAction, LessonRequest } from '../../../types';
import { buildOfflineLesson } from './offlineLesson';
import { cleanupJsonMarkers, extractJsonArray } from './validate';

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

const env = (name: string): string => {
  try {
    return (typeof process !== 'undefined' && (process as any).env?.[name]) || '';
  } catch {
    return '';
  }
};

// ---------------------------------------------------------- Cloudflare Workers AI (primary)
export const cloudflareProvider: TextProvider = {
  id: 'cloudflare',
  name: 'Cloudflare Workers AI (GLM-4.7-Flash)',
  async complete(req, system, user) {
    const accountId = env('CLOUDFLARE_ACCOUNT_ID');
    const apiToken = env('CLOUDFLARE_API_TOKEN');
    if (!accountId || !apiToken) return null;

    const body = {
      model: '@cf/zai-org/glm-4.7-flash',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.5,
      max_tokens: 4096,
      reasoning: { enabled: false },
    };

    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/zai-org/glm-4.7-flash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.errors?.[0]?.message || `Cloudflare HTTP ${res.status}`);
      const text = data?.result?.choices?.[0]?.message?.content;
      if (!text) throw new Error('Cloudflare returned empty content');
      return { text, model: data?.result?.model || body.model, provider: 'cloudflare' };
    } catch (e) {
      console.warn('[ai] Cloudflare failed:', (e as Error).message);
      throw e;
    }
  },
};

// ---------------------------------------------------------- OpenRouter (LLM fallback)
export const openRouterProvider: TextProvider ={
  id: 'openrouter',
  name: 'OpenRouter (free)',
  async complete(req, system, user) {
    const apiKey = env('OPENROUTER_API_KEY');
    if (!apiKey) return null;

    const body = {
      model: 'openrouter/free',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.5,
      max_tokens: 4096,
      reasoning: { enabled: false },
    };

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || `OpenRouter HTTP ${res.status}`);
      const content = data?.choices?.[0]?.message?.content;
      const text = content || data?.choices?.[0]?.message?.reasoning;
      if (!text) throw new Error('OpenRouter returned empty content');
      return { text, model: data?.model || body.model, provider: 'openrouter' };
    } catch (e) {
      console.warn('[ai] OpenRouter failed:', (e as Error).message);
      throw e;
    }
  },
};

// ---------------------------------------------------------- Pollinations secondary text/LLM fallback
export const pollinationsProvider: TextProvider ={
  id: 'pollinations',
  name: 'Pollinations (free)',
  async complete(req, system, user) {
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

// ---------------------------------------------------------- Gemini (optional premium; operative in AI Studio worldwide)
export const geminiProvider: TextProvider ={
  id: 'gemini',
  name: 'Gemini (Google AI Studio)',
  async complete(req, system, user) {
    const apiKey = (typeof window !== 'undefined' && (window as any).__SMARTBOARD_AI_KEY__) || env('GEMINI_API_KEY');
    if (!apiKey) return null;

    const body = {
      model: 'gemini-2.5-flash',
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
      return { text, model: data?.model || body.model, provider: 'gemini' };
    } catch (e) {
      console.warn('[ai] Gemini failed:', (e as Error).message);
      throw e;
    }
  },
};

// ---------------------------------------------------------- Offline deterministic builder (always works)
export const offlineProvider: TextProvider ={
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
  cloudflareProvider,
  openRouterProvider,
  pollinationsProvider,
  geminiProvider,
  offlineProvider,
];

// Convenience helper for tests..
export const textToBoardCommands = (text: string): BoardAction[] => {
  const cleaned = cleanupJsonMarkers(text);
  const arr = extractJsonArray(cleaned);
  if (arr) {
    return arr as BoardAction[];
  }
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed as BoardAction[];
    if (parsed && typeof parsed === 'object' && (parsed as any).commands) return (parsed as any).commands as BoardAction[];
  } catch (e) { /* ignore */ }
  return [];
};
