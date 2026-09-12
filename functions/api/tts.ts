interface TtsBody {
  text: string;
  language?: string;
 }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export const onRequest = async ({ request, env }) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS });


   try {
    const { text, language } = await request.json() as TtsBody;
    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing text' }), { status: 400, headers: CORS });
    }

    const apiKey = (env as any).GEMINI_API_KEY || (process as any).env?.GEMINI_API_KEY;
   if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured on server' }), { status: 503, headers: CORS });
    }

    const model = 'gemini-3.1-flash-tts-preview';
    const voice = (language || 'ar').toLowerCase().startsWith('ar') ? 'Zephyr' : 'Puck';
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error?.message || ('TTS HTTP ' + res.status));
    }

    const audioData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) throw new Error('No audio data returned from API');

    return new Response(JSON.stringify({ audioData }), { status: 200, headers: CORS });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || 'TTS failed' }), { status: 500, headers: CORS });
  }
};