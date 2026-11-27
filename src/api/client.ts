/// <reference types="vite/client" />

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  createdAt: number;
  isPlatformAdmin?: boolean;
  status?: string;
}

export interface ApiOrg {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  owner_id: string;
  created_at: number;
  updated_at: number;
}

export interface PlanInfo {
  id: string;
  name: string;
  tagline: string;
  priceEgp: number;
  priceUsd: number;
  seats: number;
  dailyChats: number;
  maxLessons: number;
  maxApiKeys: number;
  api: boolean;
  mcp: boolean;
  priorityRouting: boolean;
  features: string[];
}

export interface ApiSubscription {
  id: string;
  org_id: string;
  plan: string;
  status: string;
  seats: number;
  provider: string;
  current_period_start?: number | null;
  current_period_end?: number | null;
  cancel_at_period_end?: number;
}

export interface ApiMe {
  user: ApiUser;
  org?: ApiOrg;
  plan?: PlanInfo;
  subscription?: ApiSubscription;
  authKind?: string;
}

export interface ApiKeySummary {
  id: string;
  name: string;
  prefix: string;
  scopes: string;
  created_at: number;
  last_used_at?: number | null;
  revoked_at?: number | null;
}

export interface ManualInstructions {
  currency: string;
  contact: string;
  whatsapp: string | null;
  methods: { id: string; name: string; value: string; note: string }[];
  steps: string[];
  plans: { id: string; name: string; priceEgp: number; seats: number }[];
}

export interface ModelInfo {
  id: string;
  label: string;
  provider: string;
  capabilities: { streaming: boolean; json: boolean; vision?: boolean };
  contextWindow?: number;
}

export interface LessonSummary {
  id: string;
  title: string;
  lang: string;
  updated_at: number;
}

export interface LessonDetail {
  id: string;
  title: string;
  lang: string;
  script: unknown;
  createdAt: number;
  updatedAt: number;
}

export interface ChatRequest {
  model: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  mode?: 'lesson' | 'continue';
  board?: unknown;
  lang?: string;
  maxTokens?: number;
  extended?: boolean;
}

export interface ChatHandlers {
  onMeta?: (meta: { requestId: string; model: string }) => void;
  onDelta?: (text: string) => void;
  onOp?: (op: unknown) => void;
  onStep?: (count: number) => void;
  onWarning?: (errors: string[]) => void;
  onDone?: (info: { requestId: string; chars: number; ops: number; steps: number }) => void;
  onError?: (error: Error) => void;
}

export class ApiError extends Error {
  readonly status: number;
  readonly requestId?: string;

  constructor(message: string, status: number, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.requestId = requestId;
  }
}

export const API_BASE = ((import.meta.env.VITE_API_BASE as string | undefined) ?? '/api').replace(/\/$/, '');

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(API_BASE + path, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
  const requestId = res.headers.get('x-request-id') || undefined;
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; requestId?: string };
    throw new ApiError(data.error || res.statusText || 'Request failed', res.status, data.requestId || requestId);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function* parseSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<{ event: string; data: string }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, '\n');
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        let event = 'message';
        const data: string[] = [];
        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) data.push(line.slice(5).trim());
        }
        if (data.length) yield { event, data: data.join('\n') };
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function streamChat(body: ChatRequest, handlers: ChatHandlers, signal?: AbortSignal): Promise<void> {
  const res = await fetch(API_BASE + '/v1/chat/stream', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; requestId?: string };
    throw new ApiError(data.error || res.statusText || 'Stream request failed', res.status, data.requestId);
  }
  if (!res.body) throw new Error('The API returned an empty stream');
  for await (const evt of parseSSE(res.body)) {
    let data: Record<string, unknown> = {};
    if (evt.data) {
      try {
        data = JSON.parse(evt.data) as Record<string, unknown>;
      } catch {
        continue;
      }
    }
    switch (evt.event) {
      case 'meta':
        handlers.onMeta?.(data as { requestId: string; model: string });
        break;
      case 'delta':
        if (typeof data.text === 'string') handlers.onDelta?.(data.text);
        break;
      case 'op':
        handlers.onOp?.(data.op);
        break;
      case 'step':
        if (typeof data.count === 'number') handlers.onStep?.(data.count);
        break;
      case 'warning':
        if (Array.isArray(data.errors)) handlers.onWarning?.(data.errors as string[]);
        break;
      case 'done':
        handlers.onDone?.(data as { requestId: string; chars: number; ops: number; steps: number });
        break;
      case 'error':
        handlers.onError?.(new Error(typeof data.message === 'string' ? data.message : 'Stream error'));
        break;
      default:
        break;
    }
  }
}

export const api = {
  me: () => apiFetch<ApiMe>('/auth/me'),
  login: (email: string, password: string) =>
    apiFetch<{ user: ApiUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email: string, password: string, name?: string) =>
    apiFetch<{ user: ApiUser }>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }),
  logout: () => apiFetch<{ ok: true }>('/auth/logout', { method: 'POST' }),
  models: () => apiFetch<{ models: ModelInfo[] }>('/v1/models'),
  lessons: () => apiFetch<{ lessons: LessonSummary[] }>('/v1/lessons'),
  lesson: (id: string) => apiFetch<{ lesson: LessonDetail }>('/v1/lessons/' + encodeURIComponent(id)),
  createLesson: (body: { title?: string; lang?: string; script: unknown }) =>
    apiFetch<{ lesson: LessonSummary }>('/v1/lessons', { method: 'POST', body: JSON.stringify(body) }),
  updateLesson: (id: string, body: { title?: string; lang?: string; script?: unknown }) =>
    apiFetch<{ ok: true }>('/v1/lessons/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(body) }),
  deleteLesson: (id: string) =>
    apiFetch<{ ok: true }>('/v1/lessons/' + encodeURIComponent(id), { method: 'DELETE' }),
  apiKeys: {
    list: () => apiFetch<{ apiKeys: ApiKeySummary[] }>('/v1/api-keys'),
    create: (body: { name?: string; scopes?: string }) =>
      apiFetch<{ key: string; apiKey: ApiKeySummary }>('/v1/api-keys', { method: 'POST', body: JSON.stringify(body) }),
    revoke: (id: string) =>
      apiFetch<{ ok: true }>('/v1/api-keys/' + encodeURIComponent(id), { method: 'DELETE' }),
  },
  billing: {
    plans: () => apiFetch<{ plans: PlanInfo[]; currency: string }>('/v1/billing/plans'),
    subscription: () => apiFetch<{ subscription?: ApiSubscription; plan?: PlanInfo; org?: ApiOrg }>('/v1/billing/subscription'),
    instructions: () => apiFetch<ManualInstructions>('/v1/billing/manual-instructions'),
    requestManual: (body: { plan: string; method: string; reference?: string; note?: string }) =>
      apiFetch<{ ok: true; request: { id: string; plan: string; method: string; amountEgp: number; status: string; message: string } }>(
        '/v1/billing/manual-request',
        { method: 'POST', body: JSON.stringify(body) },
      ),
    redeem: (code: string) =>
      apiFetch<{ ok: true; plan: string; seats: number; periodEnd: number }>('/v1/billing/redeem', {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),
    checkout: (plan: string) =>
      apiFetch<{ configured: boolean; url?: string; error?: string }>('/v1/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ plan }),
      }),
  },
};
