import type { LessonRequest } from '../../types';

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





  const [{ PROVIDERS }, { buildOfflineLesson }] = await Promise.all([
    import('../../services/ai/omnirouter/providers'),
    import('../../services/ai/omnirouter/offlineLesson'),
  ]);

   try {
    const body = await request.json() as ChatBody;
    if (!body?.req || typeof body?.system !== 'string' || typeof body?.user !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid body: expected { req, system, user }' }), { status: 400, headers: corsHeaders() });
    }

    const { req, system, user } = body;
    let lastErr: string | null = null;

    // 3. Try every real provider in order (same priority as the client usedtto).
    for (const p of PROVIDERS) {
      if (p.id === 'offline') continue;
      try {
        const res = await p.complete(req, system, user);
        if (res && res.text && res.text.trim().length > 0) {
          return new Response(JSON.stringify({ text: res.text, model: res.model, provider: res.provider }), { status: 200, headers: corsHeaders() });
        }
      } catch (e) {
        lastErr = (e as Error).message || '';
        console.warn('[api/chat]', p.id, 'failed:', lastErr);
      }
    }

    // 4. Deterministic offline fallback (always works, no network).
    try {
      const text = JSON.stringify(buildOfflineLesson(req));
      return new Response(JSON.stringify({ text, model: 'offline-deterministic', provider: 'offline' }), { status: 200, headers: corsHeaders() });
    } catch (e) {
      lastErr = (e as Error).message || lastErr;
    }

    return new Response(JSON.stringify({ error: 'All AI providers failed. ' + (lastErr || '') }), { status: 502, headers: corsHeaders() });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || 'Unexpected error' }), { status: 500, headers: corsHeaders() });
  }
};

function corsHeaders(): Record<string, string> {




  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}