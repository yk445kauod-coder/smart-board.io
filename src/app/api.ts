export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const base = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';
  const headers: Record<string, string> = { accept: 'application/json' };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  const response = await fetch(`${base}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });
  const text = await response.text();
  const payload: unknown = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = payload && typeof payload === 'object' ? (payload as { error?: { code?: string; message?: string } }).error : undefined;
    throw new ApiError(response.status, error?.code ?? 'http_error', error?.message ?? response.statusText);
  }
  return payload as T;
}

export async function uploadFile(token: string, orgId: string, file: File): Promise<{ key: string; url: string }> {
  const base = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';
  const response = await fetch(`${base}/api/orgs/${orgId}/uploads`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': file.type },
    body: file,
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload && typeof payload === 'object' ? (payload as { error?: { message?: string } }).error : undefined;
    throw new ApiError(response.status, 'upload_failed', error?.message ?? 'upload failed');
  }
  return payload as { key: string; url: string };
}
