import { Hono } from 'hono';
import type { AppEnv } from './env';
import { requireAuth, requireOrg } from './auth';
import { dbAll, dbFirst, dbRun, newId, now } from './db';
import { publicModels } from './models';
import { completeOmni, providerHealth } from './omni';
import { buildSystemPrompt, buildUserPrompt } from '../../src/protocol/prompt';
import { parseProtocolScript } from '../../src/protocol/parse';
import { validateScript } from '../../src/protocol/validate';
import { sanitizeScript } from './sanitize';
import { getPlan } from './plans';

const mcp = new Hono<AppEnv>();

mcp.use('*', requireAuth, requireOrg);

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
}

const textResult = (text: string, isError = false) => ({
  content: [{ type: 'text', text }],
  isError,
});

const jsonText = (value: unknown) => JSON.stringify(value, null, 2);

const TOOLS = [
  {
    name: 'smartboard_health',
    description: 'Check the SmartBoard API, D1 database, and current workspace.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'smartboard_list_models',
    description: 'List model ids, provider tiers, and whether each provider is configured.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'smartboard_generate_lesson',
    description: 'Generate a complete whiteboard lesson protocol (JSON) from a teacher prompt. Uses OmniRouter: FreeLLMAPI, OpenRouter, Gemini, Workers AI, Pollinations, then a deterministic offline builder.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'What to teach, e.g. "Explain photosynthesis to a 12-year-old".' },
        lang: { type: 'string', description: 'Language tag, e.g. ar or en.' },
        mode: { type: 'string', enum: ['lesson', 'continue'], description: 'lesson (default) or continue.' },
        extended: { type: 'boolean', description: 'Allow extended ops (table, graph, atlas, periodic). Default true.' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'smartboard_save_lesson',
    description: 'Save a validated protocol script to the current workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        lang: { type: 'string' },
        script: { type: 'object', description: 'ProtocolScript: { title?, lang?, steps: [...] }' },
      },
      required: ['script'],
    },
  },
  {
    name: 'smartboard_list_lessons',
    description: 'List lessons in the current workspace.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number', minimum: 1, maximum: 100 } },
    },
  },
  {
    name: 'smartboard_get_lesson',
    description: 'Load one lesson by id.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'smartboard_usage',
    description: 'Show plan limits and today\'s AI usage for this workspace.',
    inputSchema: { type: 'object', properties: {} },
  },
];

const callTool = async (c: any, name: string, args: Record<string, unknown>) => {
  const user = c.get('user');
  const org = c.get('org');
  const plan = c.get('plan') || getPlan('free');
  switch (name) {
    case 'smartboard_health': {
      let dbOk = false;
      try {
        await dbFirst(c.env.DB, 'SELECT 1 AS ok');
        dbOk = true;
      } catch {
        dbOk = false;
      }
      return textResult(jsonText({
        ok: dbOk,
        db: dbOk,
        user: { id: user.id, email: user.email },
        org: { id: org.id, name: org.name, plan: plan.id },
        ts: now(),
      }));
    }
    case 'smartboard_list_models':
      return textResult(jsonText({
        models: publicModels(),
        providers: providerHealth(c.env),
        routing: 'Send model "auto" to use OmniRouter.',
      }));
    case 'smartboard_generate_lesson': {
      const prompt = String(args.prompt || '').trim();
      if (!prompt) return textResult('prompt is required', true);
      const lang = String(args.lang || 'en');
      const extended = args.extended !== false;
      const system = buildSystemPrompt({ extended, lang });
      const userPrompt = buildUserPrompt({
        question: prompt,
        mode: args.mode === 'continue' ? 'continue' : 'lesson',
        lang,
      });
      const result = await completeOmni({
        planId: plan.id,
        system,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens: 6000,
        env: c.env,
        signal: c.req.raw.signal,
      });
      const parsed = parseProtocolScript(result.text, { extended });
      const script = parsed.script ? sanitizeScript(parsed.script) : null;
      const errors = script ? validateScript(script, { extended }) : parsed.errors;
      return textResult(jsonText({
        provider: result.provider,
        model: result.model,
        title: (script as { title?: string } | null)?.title,
        errors,
        script,
        raw: script ? undefined : result.text,
      }), !script);
    }
    case 'smartboard_save_lesson': {
      const script = args.script;
      const errors = validateScript(script, { extended: true });
      if (errors.length) return textResult(jsonText({ errors }), true);
      const id = newId();
      const ts = now();
      const meta = script as { title?: string; lang?: string };
      const title = String(args.title || meta.title || 'Untitled lesson').slice(0, 120);
      const lang = String(args.lang || meta.lang || 'ar').slice(0, 20);
      await dbRun(
        c.env.DB,
        'INSERT INTO lessons (id, user_id, org_id, title, lang, script_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        id,
        user.id,
        org.id,
        title,
        lang,
        JSON.stringify(script),
        ts,
        ts,
      );
      return textResult(jsonText({ ok: true, lesson: { id, title, lang, updatedAt: ts } }));
    }
    case 'smartboard_list_lessons': {
      const limit = Math.min(Math.max(Number(args.limit || 30), 1), 100);
      const rows = await dbAll(
        c.env.DB,
        'SELECT id, title, lang, updated_at FROM lessons WHERE org_id = ? ORDER BY updated_at DESC LIMIT ?',
        org.id,
        limit,
      );
      return textResult(jsonText({ lessons: rows }));
    }
    case 'smartboard_get_lesson': {
      const row = await dbFirst<{ id: string; title: string; lang: string; script_json: string; created_at: number; updated_at: number }>(
        c.env.DB,
        'SELECT id, title, lang, script_json, created_at, updated_at FROM lessons WHERE id = ? AND org_id = ?',
        String(args.id || ''),
        org.id,
      );
      if (!row) return textResult('lesson not found', true);
      let script: unknown = {};
      try { script = JSON.parse(row.script_json); } catch { /* keep empty */ }
      return textResult(jsonText({
        lesson: { id: row.id, title: row.title, lang: row.lang, script, createdAt: row.created_at, updatedAt: row.updated_at },
      }));
    }
    case 'smartboard_usage': {
      const since = now() - 86_400_000;
      const row = await dbFirst<{ n: number }>(
        c.env.DB,
        "SELECT COUNT(*) AS n FROM usage_events WHERE org_id = ? AND kind = 'chat' AND created_at > ?",
        org.id,
        since,
      );
      const used = row?.n || 0;
      return textResult(jsonText({
        plan: plan.id,
        dailyChats: plan.dailyChats,
        usedToday: used,
        remaining: Math.max(0, plan.dailyChats - used),
        maxLessons: plan.maxLessons,
        maxApiKeys: plan.maxApiKeys,
      }));
    }
    default:
      return null;
  }
};

mcp.get('/', (c) =>
  c.json({
    name: 'smartboard-mcp',
    version: '1.0.0',
    protocol: '2024-11-05',
    transport: 'streamable-http',
    endpoint: '/mcp',
    tools: TOOLS.map((t) => t.name),
  }),
);

mcp.post('/', async (c) => {
  let body: JsonRpcRequest | JsonRpcRequest[];
  try {
    body = await c.req.json();
  } catch {
    return c.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400);
  }
  const handle = async (req: JsonRpcRequest) => {
    const id = req.id ?? null;
    if (req.jsonrpc !== '2.0' || typeof req.method !== 'string') {
      return { jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid Request' } };
    }
    if (req.method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'smartboard-mcp', version: '1.0.0' },
          instructions: 'Generate, save, and load SmartBoard lessons. Use model "auto" for OmniRouter.',
        },
      };
    }
    if (req.method === 'notifications/initialized' || req.method === 'notifications/cancelled') {
      return null;
    }
    if (req.method === 'ping') return { jsonrpc: '2.0', id, result: {} };
    if (req.method === 'tools/list') return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
    if (req.method === 'tools/call') {
      const params = req.params || {};
      const name = String(params.name || '');
      const args = (params.arguments || {}) as Record<string, unknown>;
      const result = await callTool(c, name, args);
      if (!result) return { jsonrpc: '2.0', id, error: { code: -32602, message: 'Unknown tool: ' + name } };
      return { jsonrpc: '2.0', id, result };
    }
    return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found: ' + req.method } };
  };

  if (Array.isArray(body)) {
    const results = await Promise.all(body.map(handle));
    return c.json(results.filter(Boolean));
  }
  const result = await handle(body);
  if (result === null) return c.body(null, 204);
  return c.json(result);
});

export default mcp;
