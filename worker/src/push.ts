import type { Env } from './env';
import { dbAll, dbRun, now } from './db';

export interface PushSubscriptionRecord {
  id: string;
  org_id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent?: string | null;
  created_at: number;
  last_seen_at: number;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
}

const enc = new TextEncoder();

export const b64urlToBytes = (value: string): Uint8Array => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
};

export const bytesToB64url = (bytes: Uint8Array): string => {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

const hmac = async (key: Uint8Array, data: Uint8Array): Promise<Uint8Array> => {
  const imported = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', imported, data));
};

const uint32 = (n: number): Uint8Array => {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, n, false);
  return out;
};

const validateKeys = (p256dh: string, auth: string): void => {
  const pub = b64urlToBytes(p256dh);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error('invalid p256dh key');
  if (b64urlToBytes(auth).length !== 16) throw new Error('invalid auth secret');
};

const allowedPushHost = (hostname: string): boolean => {
  const host = hostname.toLowerCase();
  const suffixes = [
    'fcm.googleapis.com',
    'android.googleapis.com',
    'push.services.mozilla.com',
    'notify.windows.com',
    'push.apple.com',
  ];
  return suffixes.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
};

export const validateEndpoint = (endpoint: string): URL => {
  const url = new URL(endpoint);
  if (url.protocol !== 'https:') throw new Error('endpoint must be https');
  if (!allowedPushHost(url.hostname)) throw new Error('unsupported push service');
  return url;
};

/**
 * RFC 8291 aes128gcm payload encryption. Web Crypto is available in Workers;
 * no Node crypto or third-party dependency is needed.
 */
export const encryptPayload = async (
  plaintext: string,
  p256dh: string,
  auth: string,
): Promise<{ body: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> => {
  validateKeys(p256dh, auth);
  const authSecret = b64urlToBytes(auth);
  const userPublicKey = await crypto.subtle.importKey(
    'raw',
    b64urlToBytes(p256dh),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  const ephemeral = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])) as CryptoKeyPair;
  const deriveAlgorithm = { name: 'ECDH', public: userPublicKey } as unknown as SubtleCryptoDeriveKeyAlgorithm;
  const shared = new Uint8Array(await crypto.subtle.deriveBits(deriveAlgorithm, ephemeral.privateKey, 256));
  const rawPublic = (await crypto.subtle.exportKey('raw', ephemeral.publicKey)) as ArrayBuffer;
  const serverPublicKey = new Uint8Array(rawPublic);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const prk = await hmac(authSecret, shared);
  const keyInfo = concat(enc.encode('WebPush: info\0'), b64urlToBytes(p256dh), serverPublicKey);
  const ikm = await hmac(prk, concat(keyInfo, new Uint8Array([1])));
  const prk2 = await hmac(salt, ikm);
  const cek = (await hmac(prk2, concat(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk2, concat(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);

  const recordSize = 4096;
  const header = concat(salt, uint32(recordSize), new Uint8Array([serverPublicKey.length]), serverPublicKey);
  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce, additionalData: header, tagLength: 128 },
      aesKey,
      concat(enc.encode(plaintext), new Uint8Array([2])),
    ),
  );
  return { body: concat(header, ciphertext), salt, serverPublicKey };
};

export const vapidAuthorization = async (endpoint: string, env: Env): Promise<string> => {
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) throw new Error('push is not configured');
  const url = new URL(endpoint);
  const header = bytesToB64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = bytesToB64url(
    enc.encode(
      JSON.stringify({
        aud: url.origin,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: env.VAPID_SUBJECT || 'mailto:admin@smartboard.ai',
      }),
    ),
  );
  const data = enc.encode(`${header}.${payload}`);
  const key = await crypto.subtle.importKey(
    'jwk',
    JSON.parse(env.VAPID_PRIVATE_KEY) as JsonWebKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, data));
  return `vapid t=${header}.${payload}.${bytesToB64url(signature)}, k=${env.VAPID_PUBLIC_KEY}`;
};

export const sendWebPush = async (sub: PushSubscriptionRecord, payload: PushPayload, env: Env): Promise<Response> => {
  validateEndpoint(sub.endpoint);
  const { body } = await encryptPayload(JSON.stringify(payload), sub.p256dh, sub.auth);
  const authorization = await vapidAuthorization(sub.endpoint, env);
  return fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'normal',
    },
    body: body.buffer as ArrayBuffer,
  });
};

export const notifyUser = async (
  env: Env,
  orgId: string,
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; total: number }> => {
  const subs = await dbAll<PushSubscriptionRecord>(
    env.DB,
    'SELECT * FROM push_subscriptions WHERE org_id = ? AND user_id = ? AND revoked_at IS NULL',
    orgId,
    userId,
  );
  let sent = 0;
  for (const sub of subs) {
    try {
      const res = await sendWebPush(sub, payload, env);
      if (res.ok) {
        sent++;
        await dbRun(env.DB, 'UPDATE push_subscriptions SET last_seen_at = ? WHERE id = ?', now(), sub.id);
      } else if (res.status === 404 || res.status === 410) {
        await dbRun(env.DB, 'UPDATE push_subscriptions SET revoked_at = ? WHERE id = ?', now(), sub.id);
      }
    } catch {
      // One bad endpoint must not stop delivery to the rest.
    }
  }
  return { sent, total: subs.length };
};
