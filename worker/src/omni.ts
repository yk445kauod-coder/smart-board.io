import type { Env } from './env';
import type { ChatTurn, ProtocolScript } from '../../src/protocol/types';
import { getModel, MODELS, type ModelDef } from './models';
import { streamChat } from './providers';
import { planTier } from './plans';

export interface OmniAttempt {
  model: string;
  provider: string;
  ok: boolean;
  error?: string;
}

export interface OmniOptions {
  planId?: string;
  system: string;
  messages: ChatTurn[];
  maxTokens?: number;
  env: Env;
  signal?: AbortSignal;
  onProvider?: (model: ModelDef) => void;
  onAttempt?: (attempt: OmniAttempt) => void;
}

export const providerAvailable = (model: ModelDef, env: Env): boolean => {
  switch (model.provider) {
    case 'workers-ai':
      return Boolean(env.AI);
    case 'pollinations':
      return true;
    case 'freellmapi':
      return Boolean(env.FREELLMAPI_BASE_URL);
    case 'openrouter':
      return Boolean(env.OPENROUTER_API_KEY);
    case 'gemini':
      return Boolean(env.GEMINI_API_KEY);
    case 'deepseek':
      return Boolean(env.DEEPSEEK_API_KEY);
    case 'anthropic':
      return Boolean(env.ANTHROPIC_API_KEY);
    default:
      return false;
  }
};

const pick = (ids: string[]): ModelDef[] =>
  ids.map((id) => getModel(id)).filter((m): m is ModelDef => Boolean(m));

/**
 * Provider order for the automatic router.
 * Free works with zero keys (Pollinations + Workers AI + deterministic offline).
 * Paid plans get the strongest providers first when keys are configured.
 */
export function buildChain(planId?: string): ModelDef[] {
  const paid = planTier(planId) >= 1;
  const premium = pick([
    'freellmapi/auto',
    'openrouter/google/gemini-2.5-flash',
    'gemini/gemini-2.5-flash',
    'openrouter/anthropic/claude-3.5-haiku',
    'anthropic/claude-3-5-haiku-latest',
    'deepseek/deepseek-chat',
  ]);
  const keyless = pick([
    'freellmapi/auto',
    'pollinations/openai',
    'workers-ai/@cf/meta/llama-3.1-8b-instruct',
    'openrouter/meta-llama/llama-3.3-70b-instruct',
    'openrouter/deepseek/deepseek-chat',
  ]);
  const ordered = paid ? [...premium, ...keyless] : keyless;
  const seen = new Set<string>();
  return ordered.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

export function providerHealth(env: Env) {
  return MODELS.filter((m) => m.provider !== 'omni').map((m) => ({
    id: m.id,
    label: m.label,
    provider: m.provider,
    tier: m.tier || 'premium',
    keyless: Boolean(m.keyless),
    available: providerAvailable(m, env),
  }));
}

const escapeXml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function buildOfflineScript(question: string, lang = 'en'): ProtocolScript {
  const ar = lang.toLowerCase().startsWith('ar');
  const title = (question || (ar ? 'درس جديد' : 'New lesson')).slice(0, 70);
  const line = (id: string, x: number, y: number, text: string, size = 38, color: 'ink' | 'blue' | 'green' = 'ink') => ({
    op: 'write' as const,
    id,
    x,
    y,
    text: escapeXml(text),
    size,
    color,
    anchor: 'start' as const,
  });
  return {
    title,
    lang,
    steps: [
      {
        title: ar ? 'المقدمة' : 'Introduction',
        say: ar ? `سنبدأ درس اليوم عن ${title}.` : `Today we start with ${title}.`,
        ops: [
          line('title', 800, 80, title, 58, 'ink'),
          { op: 'line', id: 'title-rule', x1: 300, y1: 170, x2: 1300, y2: 170, color: 'blue', width: 4 },
        ],
      },
      {
        title: ar ? 'الفكرة الأساسية' : 'Key idea',
        say: ar ? 'نحدد الفكرة المحورية قبل التفاصيل.' : 'We define the central idea before the details.',
        ops: [
          { op: 'rect', id: 'idea-box', x: 160, y: 250, w: 620, h: 180, color: 'blue', width: 4, fill: 'blue' },
          line('idea-label', 200, 280, ar ? 'الفكرة الأساسية' : 'Key idea', 34, 'blue'),
          line('idea-text', 200, 340, title, 40, 'ink'),
        ],
      },
      {
        title: ar ? 'خطوات التعلم' : 'Learning steps',
        say: ar ? 'نتابع الخطوات بالترتيب.' : 'We follow the steps in order.',
        ops: [
          line('steps-title', 880, 270, ar ? 'خطوات التعلم' : 'Learning steps', 42, 'green'),
          line('step-1', 880, 340, ar ? '١. اقرأ المفهوم' : '1. Read the concept', 36),
          line('step-2', 880, 400, ar ? '٢. حل مثالًا' : '2. Work an example', 36),
          line('step-3', 880, 460, ar ? '٣. طبّق بنفسك' : '3. Apply it yourself', 36),
        ],
      },
      {
        title: ar ? 'مثال' : 'Example',
        say: ar ? 'نطبق الفكرة على مثال بسيط.' : 'We apply the idea to a simple example.',
        ops: [
          line('example-title', 160, 530, ar ? 'مثال تطبيقي' : 'Worked example', 42, 'blue'),
          { op: 'rect', id: 'example-box', x: 160, y: 600, w: 1180, h: 170, color: 'gray', width: 3, fill: 'gray' },
          line('example-text', 210, 650, ar ? 'اكتب خطوات الحل هنا خطوة بخطوة.' : 'Write the solution here, one step at a time.', 36),
        ],
      },
      {
        title: ar ? 'الخلاصة' : 'Check for understanding',
        say: ar ? 'نراجع الفكرة ونتحقق من الفهم.' : 'We review the idea and check understanding.',
        ops: [
          line('check-title', 160, 810, ar ? 'تحقق من الفهم' : 'Check for understanding', 40, 'green'),
          line('check-1', 160, 870, ar ? 'اشرح الفكرة بكلماتك.' : 'Explain the idea in your own words.', 32),
        ],
      },
    ],
  };
}

export async function* streamOmni(opts: OmniOptions): AsyncGenerator<string> {
  const chain = buildChain(opts.planId);
  const failures: string[] = [];
  for (const model of chain) {
    if (!providerAvailable(model, opts.env)) {
      opts.onAttempt?.({ model: model.id, provider: model.provider, ok: false, error: 'not configured' });
      continue;
    }
    let started = false;
    try {
      for await (const delta of streamChat({
        model,
        system: opts.system,
        messages: opts.messages,
        maxTokens: opts.maxTokens,
        env: opts.env,
        signal: opts.signal,
      })) {
        if (!started) {
          started = true;
          opts.onProvider?.(model);
        }
        yield delta;
      }
      if (!started) throw new Error('empty stream');
      opts.onAttempt?.({ model: model.id, provider: model.provider, ok: true });
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      opts.onAttempt?.({ model: model.id, provider: model.provider, ok: false, error: message });
      failures.push(`${model.provider}: ${message}`);
      if (started) throw err;
    }
  }

  const question = opts.messages.map((m) => m.content).join(' ').slice(0, 400);
  const offline = buildOfflineScript(question, 'en');
  opts.onProvider?.({
    id: 'offline/deterministic',
    label: 'Offline deterministic builder',
    provider: 'workers-ai',
    upstream: 'offline',
    capabilities: { streaming: true, json: true },
    tier: 'keyless',
    keyless: true,
  });
  opts.onAttempt?.({ model: 'offline/deterministic', provider: 'offline', ok: true });
  yield JSON.stringify(offline);
}

export async function completeOmni(
  opts: OmniOptions,
): Promise<{ text: string; provider: string; model: string }> {
  let text = '';
  let provider = 'offline';
  let model = 'offline/deterministic';
  for await (const delta of streamOmni({
    ...opts,
    onProvider: (m) => {
      provider = m.provider;
      model = m.id;
      opts.onProvider?.(m);
    },
  })) {
    text += delta;
  }
  return { text, provider, model };
}
