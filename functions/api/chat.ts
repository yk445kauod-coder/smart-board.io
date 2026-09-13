import type { LessonRequest } from '../../types';
import { isPlainResponseMode } from '../../services/ai/omnirouter/validate';

interface ChatBody {
  req: LessonRequest;

  system: string;
  user: string;
 }

const ENV_KEYS = [
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_API_TOKEN',
  'OPENROUTER_API_KEY',
  'POLLINATIONS_API_KEY',
  'GEMINI_API_KEY',
  'API_KEY',
];

export const onRequest = async (context) => {
  const { request, env, next } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: `Method ${request.method} not allowed` }), { status: 405, headers: corsHeaders() });
  }

  // 1. Surface Page secrets into process.env for the shared providers module.



  for (const k of ENV_KEYS) {
    const v = (env as any)[k];
    if (typeof v === 'string' && v.length > 0) {
      (process as any).env[k] = v;
    }
  }
  const secretEnv = env as Record<string, string>;

  // 2. Dynamic import so the providers module reads the keys the set above.





  const [{ PROVIDERS }, { textToBoardCommands: parseBoardCommands }] = await Promise.all([
    import('../../services/ai/omnirouter/providers'),
    import('../../services/ai/omnirouter/providers'),
  ]);

   try {
    const body = await request.json() as ChatBody;
    if (!body?.req || typeof body?.system !== 'string' || typeof body?.user !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid body: expected { req, system, user }' }), { status: 400, headers: corsHeaders() });
    }

    const { req, system, user } = body;
    let lastErr: string | null = null;

    // 3. Try every real provider in order (same priority as the client usedtto).
    const needsBoardCommands = !isPlainResponseMode(req.mode);
    const providers = needsBoardCommands
      ? [PROVIDERS.find(p => p.id === 'gemini'), PROVIDERS.find(p => p.id === 'openrouter')].filter(Boolean) as typeof PROVIDERS
      : PROVIDERS;
    for (const p of providers) {
      if (p.id === 'offline') continue;
      // Board-writing modes use OpenRouter's structured-capable route. The
      // current Cloudflare board model can emit safety prose or invalid shapes;
      // Cloudflare remains available for plain explanatory answers.
      if (needsBoardCommands && p.id !== 'gemini' && p.id !== 'openrouter') continue;
      try {
        const res = await withTimeout(p.complete(req, system, user), 15000, `${p.id} timed out`);
        if (res && res.text && res.text.trim().length > 0) {
          if (needsBoardCommands && parseBoardCommands(res.text).length === 0) {
            lastErr = `${p.id} returned no executable board commands`;
            continue;
          }
          return new Response(JSON.stringify({ text: res.text, model: res.model, provider: res.provider }), { status: 200, headers: corsHeaders() });
        }
      } catch (e) {
        lastErr = (e as Error).message || '';
        console.warn('[api/chat]', p.id, 'failed:', lastErr);
      }
    }

    return new Response(JSON.stringify({ error: 'No AI provider returned a usable response. ' + (lastErr || '') }), { status: 502, headers: corsHeaders() });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || 'Unexpected error' }), { status: 500, headers: corsHeaders() });
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); },
    );
  });
}

function corsHeaders(): Record<string, string> {




  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}
