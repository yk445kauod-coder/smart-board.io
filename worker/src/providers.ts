import type { Env } from './env';
import type { ModelDef } from './models';
import type { ChatTurn } from '../../src/protocol/types';

export interface StreamChatOptions {
  model: ModelDef;
  system: string;
  messages: ChatTurn[];
  maxTokens?: number;
  temperature?: number;
  env: Env;
  signal?: AbortSignal;
}

const getKey = (model: ModelDef, env: Env): string => {
  if (!model.keyEnv) return '';
  const value = env[model.keyEnv];
  if (typeof value !== 'string' || !value) {
    if (model.provider === 'freellmapi') return '';
    throw new Error(`Missing secret ${model.keyEnv}`);
  }
  return value;
};

const UPSTREAM_TIMEOUT_MS = 120_000;

function withTimeout(signal?: AbortSignal, ms = UPSTREAM_TIMEOUT_MS): AbortSignal {
  const timeout = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

async function* sseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).replace(/\r$/, '');
        buffer = buffer.slice(idx + 1);
        if (line.startsWith('data:')) {
          const data = line.slice(5).trim();
          if (data) yield data;
        }
      }
    }
    buffer += decoder.decode();
    if (buffer.startsWith('data:')) {
      const data = buffer.slice(5).trim();
      if (data) yield data;
    }
  } finally {
    reader.releaseLock();
  }
}
// part2

async function* streamOpenAICompatible(opts: StreamChatOptions): AsyncGenerator<string> {
  const { model, env } = opts;
  const key = getKey(model, env);
  const baseUrl =
    model.provider === 'freellmapi'
      ? (env.FREELLMAPI_BASE_URL || '').replace(/\/$/, '')
      : (model.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
  if (!baseUrl) throw new Error('FREELLMAPI_BASE_URL is not configured');
  const upstream =
    model.provider === 'freellmapi' ? env.FREELLMAPI_MODEL || model.upstream : model.upstream;
  const body: Record<string, unknown> = {
    model: upstream,
    stream: true,
    max_tokens: opts.maxTokens ?? 4096,
    temperature: opts.temperature ?? 0.4,
    messages: [{ role: 'system', content: opts.system }, ...opts.messages.filter((m) => m.role !== 'system')],
  };
  if (model.provider === 'openrouter' || model.provider === 'deepseek') {
    body.stream_options = { include_usage: true };
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key) headers.Authorization = 'Bearer ' + key;
  if (model.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://smartboard.ai';
    headers['X-Title'] = 'SmartBoard AI';
  }
  const res = await fetch(baseUrl + '/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: withTimeout(opts.signal),
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(model.provider + ' HTTP ' + res.status + ': ' + text.slice(0, 300));
  }
  for await (const data of sseData(res.body)) {
    try {
      const ev = JSON.parse(data) as { choices?: { delta?: { content?: string } }[]; error?: { message?: string } };
      if (ev.error?.message) throw new Error(ev.error.message);
      const delta = ev.choices?.[0]?.delta?.content;
      if (typeof delta === 'string' && delta) yield delta;
    } catch (err) {
      if (err instanceof SyntaxError) continue;
      throw err;
    }
  }
}

async function* streamPollinations(opts: StreamChatOptions): AsyncGenerator<string> {
  const baseUrl = (opts.model.baseUrl || 'https://text.pollinations.ai/openai').replace(/\/$/, '');
  const body = {
    model: opts.model.upstream || 'openai',
    stream: true,
    messages: [{ role: 'system', content: opts.system }, ...opts.messages.filter((m) => m.role !== 'system')],
    temperature: opts.temperature ?? 0.4,
  };
  try {
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: withTimeout(opts.signal, 60_000),
    });
    if (res.ok && res.body) {
      let emitted = false;
      for await (const data of sseData(res.body)) {
        try {
          const ev = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
          const delta = ev.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta) {
            emitted = true;
            yield delta;
          }
        } catch (err) {
          if (err instanceof SyntaxError) continue;
          throw err;
        }
      }
      if (emitted) return;
    }
  } catch (err) {
    console.warn('[omni] Pollinations stream failed, retrying text endpoint:', (err as Error).message);
  }

  const prompt = `${opts.system}\n\n${opts.messages.map((m) => m.content).join('\n')}`.slice(0, 6000);
  const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=openai&json=true`;
  const res = await fetch(url, { signal: withTimeout(opts.signal, 60_000) });
  if (!res.ok) throw new Error('Pollinations HTTP ' + res.status);
  const text = (await res.text()).trim();
  if (!text) throw new Error('Pollinations returned an empty response');
  yield text;
}

async function* streamAnthropic(opts: StreamChatOptions): AsyncGenerator<string> {
  const { model, env } = opts;
  const key = getKey(model, env);
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: model.upstream,
      max_tokens: opts.maxTokens ?? 4096,
      system: opts.system,
      messages: opts.messages.filter((m) => m.role !== 'system'),
      stream: true,
      temperature: opts.temperature ?? 0.4,
    }),
    signal: withTimeout(opts.signal),
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error('anthropic HTTP ' + res.status + ': ' + text.slice(0, 300));
  }
  for await (const data of sseData(res.body)) {
    try {
      const ev = JSON.parse(data) as {
        type?: string;
        delta?: { type?: string; text?: string };
        error?: { message?: string };
      };
      if (ev.type === 'error') throw new Error(ev.error?.message || 'anthropic error');
      if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text) {
        yield ev.delta.text;
      }
    } catch (err) {
      if (err instanceof SyntaxError) continue;
      throw err;
    }
  }
}

async function* streamWorkersAI(opts: StreamChatOptions): AsyncGenerator<string> {
  const ai = opts.env.AI as unknown as { run: (model: string, input: unknown) => Promise<unknown> };
  if (!ai) throw new Error('Workers AI binding is not configured');
  const result = await ai.run(opts.model.upstream, {
    messages: [{ role: 'system', content: opts.system }, ...opts.messages.filter((m) => m.role !== 'system')],
    stream: true,
    max_tokens: opts.maxTokens ?? 4096,
    temperature: opts.temperature ?? 0.4,
  });
  if (result instanceof ReadableStream) {
    for await (const data of sseData(result)) {
      try {
        const ev = JSON.parse(data) as { response?: string };
        if (typeof ev.response === 'string' && ev.response) yield ev.response;
      } catch {
        // ignore keepalives
      }
    }
    return;
  }
  const text = (result as { response?: string })?.response;
  if (typeof text === 'string' && text) yield text;
}

export async function* streamChat(opts: StreamChatOptions): AsyncGenerator<string> {
  switch (opts.model.provider) {
    case 'openrouter':
    case 'openai':
    case 'gemini':
    case 'deepseek':
    case 'freellmapi':
      yield* streamOpenAICompatible(opts);
      return;
    case 'pollinations':
      yield* streamPollinations(opts);
      return;
    case 'anthropic':
      yield* streamAnthropic(opts);
      return;
    case 'workers-ai':
      yield* streamWorkersAI(opts);
      return;
    default:
      throw new Error('Unsupported provider ' + opts.model.provider);
  }
}
