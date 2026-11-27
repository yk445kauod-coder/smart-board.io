import { AwsClient } from 'aws4fetch';

export interface StoredObject {
  body: ArrayBuffer;
  contentType: string;
}

/** Swappable storage boundary: Neon S3 today, IndexedDB/R2 later. */
export interface StorageProvider {
  put(key: string, body: ArrayBuffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
}

const SAFE_KEY = /^[a-zA-Z0-9][a-zA-Z0-9/_.-]{0,300}$/;

export function assertSafeKey(key: string): void {
  if (!SAFE_KEY.test(key) || key.includes('..') || key.includes('//')) {
    throw new Error('unsafe storage key');
  }
}

export class S3Storage implements StorageProvider {
  private readonly client: AwsClient;
  private readonly base: string;

  constructor(
    config: { accessKeyId: string; secretAccessKey: string; endpoint: string; region: string },
    private readonly bucket = 'uploads',
  ) {
    this.client = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      service: 's3',
      region: config.region,
    });
    this.base = config.endpoint.replace(/\/+$/, '');
  }

  private url(key: string): string {
    assertSafeKey(key);
    return `${this.base}/${this.bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }

  async put(key: string, body: ArrayBuffer, contentType: string): Promise<void> {
    const res = await this.client.fetch(this.url(key), {
      method: 'PUT',
      body,
      headers: { 'content-type': contentType, 'cache-control': 'private, max-age=3600' },
    });
    if (!res.ok) throw new Error(`storage put failed: ${res.status}`);
  }

  async get(key: string): Promise<StoredObject | null> {
    const res = await this.client.fetch(this.url(key), { method: 'GET' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`storage get failed: ${res.status}`);
    return { body: await res.arrayBuffer(), contentType: res.headers.get('content-type') ?? 'application/octet-stream' };
  }

  async delete(key: string): Promise<void> {
    const res = await this.client.fetch(this.url(key), { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw new Error(`storage delete failed: ${res.status}`);
  }
}

export class MemoryStorage implements StorageProvider {
  private readonly objects = new Map<string, StoredObject>();

  async put(key: string, body: ArrayBuffer, contentType: string): Promise<void> {
    assertSafeKey(key);
    this.objects.set(key, { body, contentType });
  }

  async get(key: string): Promise<StoredObject | null> {
    return this.objects.get(key) ?? null;
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }
}

export const ALLOWED_UPLOADS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
