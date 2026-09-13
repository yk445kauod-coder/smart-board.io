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

const env = (name: string): string => {
  try {
    return (typeof process !== 'undefined' && (process as any).env?.[name]) || '';
  } catch {
    return '';
  }
};

type CfMsg = { content?: unknown; reasoning?: unknown; reasoning_content?: unknown };

// GLM-family models can return the answer in content, reasoning, or reasoning_content.
// Prefer a real answer over raw reasoning text.
const readCfMessage = (msg: CfMsg): string => {
  if (!msg || typeof msg !== 'object') return '';
  const content = typeof msg.content === 'string' ? msg.content.trim() : '';
  if (content) return content;
  const reasoning =
    (typeof msg.reasoning === 'string' ? msg.reasoning : '') ||
    (typeof msg.reasoning_content === 'string' ? msg.reasoning_content : '');
  if (!reasoning.trim()) return '';
  const bullet = '[\\u2022\\u2013\\u2014\\-]';
  return reasoning
    .replace(/^\\s*\\d+[\\.\\)]\\s*.*(?:Analyze|Analyse|Evaluate|Assess|Reason|Think|Reflect|Check|Verify|Plan|Approach|Request|Input|Instruction|User|System).*/gim, '')
    .replace(/^\\s*\\*?[A-Z][^:]{2,40}:.*$/gim, '')
    .replace(new RegExp('^\\\\s*' + bullet + '\\\\s*.*$', 'gm'), '')
    .replace(new RegExp('^[\\\\s\\\\d\\\\.\\)' + bullet + '*]*$', 'g'), '')
    .replace(/\\s{2,}/g, ' ')
    .trim();
};

// ---------------------------------------------------------- Cloudflare Workers AI (primary)
export const cloudflareProvider: TextProvider = {
  id: 'cloudflare',
  name: 'Cloudflare Workers AI (GLM-4.7-Flash)',
  async complete(req, system, user) {
    const accountId = env('CLOUDFLARE_ACCOUNT_ID');
    const apiToken = env('CLOUDFLARE_API_TOKEN');
    if (!accountId || !apiToken) return null;

    // Llama is more reliable than GLM for board-building JSON. GLM remains
    // useful for natural-language explanations, where its safety layer is
    // less likely to replace the requested answer with a safety status.
    const model = isPlainResponseMode(req.mode)
      ? '@cf/zai-org/glm-4.7-flash'
      : '@cf/meta/llama-3.1-8b-instruct';
    const boardInstruction = isPlainResponseMode(req.mode)
      ? ''
      : '\nReturn a JSON object with exactly one key, "commands", whose value is the executable array. Never return a safety status, prose, markdown, or an empty response.';
    const body = {
      model,
      messages: [
        { role: 'system', content: system + boardInstruction },
        { role: 'user', content: user },
      ],
      temperature: 0.5,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
      reasoning: { enabled: false },
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/zai-org/glm-4.7-flash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.errors?.[0]?.message || `Cloudflare HTTP ${res.status}`);
      const msg: CfMsg = data?.result?.choices?.[0]?.message;
      const text = readCfMessage(msg);
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
        { role: 'system', content: system + (isPlainResponseMode(req.mode) ? '' : '\nReturn exactly one JSON object: {"commands":[...]} using only the allowed board actions. Do not return prose or safety status.') },
        { role: 'user', content: user },
      ],
      temperature: 0.5,
      max_tokens: 4096,
      ...(isPlainResponseMode(req.mode) ? { reasoning: { enabled: false } } : {}),
      ...(isPlainResponseMode(req.mode) ? {} : { response_format: { type: 'json_object' } }),
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);
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
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);
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

// Normalize the loose field shapes LLMs can emit into the canonical
// { action, id?, text?/title?/content?/items? } schema the board consumers
// (layoutCommands, applyBoardCommands, handleToolCall) rely on. Without this,
// GLM-family answers using `type`/`content` would be silently dropped.
export const normalizeBoardCommand = (raw: unknown): BoardAction | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  let type = String(r.action ?? r.type ?? r.command ?? r.name ?? '').trim();
  if (!type) return null;
  const aliases: Record<string, string> = {
    create_text: 'addNote',
    create_note: 'addNote',
    create_heading: 'addWordArt',
    add_heading: 'addWordArt',
    add_paragraph: 'addNote',
    add_bullet_points: 'addList',
    text: 'addNote',
    writeText: 'addText',
    write_text: 'addText',
  };
  const canonical = aliases[type] || type;
  type = canonical;
  const nested = (r.arguments && typeof r.arguments === 'object') ? r.arguments as Record<string, unknown> : {};
  const out: Record<string, unknown> = { ...r, ...nested, action: canonical };
  if (typeof r.action !== 'string') out.action = type;
  delete out.type;
  delete out.command;
  delete out.name;
  delete out.arguments;
  if (type === 'addNote' && out.content === undefined && out.text !== undefined) out.content = out.text;
  if (type === 'addNote' && out.content === undefined && out.markdown !== undefined) out.content = out.markdown;
  if (type === 'addWordArt' && out.text === undefined && out.content !== undefined) out.text = out.content;
  if (type === 'addList' && out.items === undefined && out.content !== undefined) {
    out.items = Array.isArray(out.content)
      ? out.content
      : String(out.content).split(/\n|•|-/).map(s => s.trim()).filter(Boolean);
  }
  // Generic array `content` is really a list of items (GLM sometimes emits
  // addList content as a plain array instead of items).
  if (Array.isArray(out.content) && out.items === undefined && (type === 'addList' || type === 'addText')) {
    out.items = out.content;
    delete out.content;
  }
  // Normalize generic string `content` or `text` into the field each action expects.
  if (out.content !== undefined && out.text === undefined && (type === 'addWordArt' || type === 'addText')) {
    out.text = out.content;
    delete out.content;
  }
  // addNote / addSticky render from `content`; many models emit `text`.
  if ((type === 'addNote' || type === 'addSticky') && out.content === undefined && out.text !== undefined) {
    out.content = out.text;
    delete out.text;
  }
  if (out.content !== undefined && out.title === undefined && ['addList', 'addTable', 'addComparison', 'addWordArt', 'addMindMap', 'addFlowchart', 'addTimeline', 'addDiagram'].includes(type)) {
    if (type === 'addWordArt') { out.text = out.text ?? out.content; delete out.content; }
    else {
      out.title = out.content;
      if (type === 'addList' && out.items === undefined) out.items = [String(out.content)];
      delete out.content;
    }
  }
  if (type === 'addEquation' && out.latex === undefined && out.content !== undefined) {
    out.latex = String(out.content);
    delete out.content;
  }
  return out as BoardAction;
};

// Convenience helper for tests..
export const textToBoardCommands = (text: string): BoardAction[] => {
  const cleaned = cleanupJsonMarkers(text);
  const arr = extractJsonArray(cleaned);
  let cmds: unknown[] | null = arr;
  if (!cmds) {
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) cmds = parsed;
      else if (parsed && typeof parsed === 'object' && (parsed as any).commands) cmds = (parsed as any).commands;
    } catch (e) { /* ignore */ }
  }
  if (!cmds) return [];
  const allowed = new Set([
    'addWordArt', 'addNote', 'addText', 'addList', 'addComparison', 'addEquation',
    'addTable', 'addImage', 'addShape', 'addSticky', 'addMindMap', 'addFlowchart',
    'addTimeline', 'addDiagram', 'addArrow', 'addLine', 'addCode', 'addAtlas',
    'addPeriodic', 'connect', 'update', 'remove',
  ]);
  return cmds
    .map(normalizeBoardCommand)
    .filter((c): c is BoardAction => c !== null && allowed.has(c.action));
};
