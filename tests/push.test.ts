import { encryptPayload, vapidAuthorization, validateEndpoint, b64urlToBytes, bytesToB64url } from '../worker/src/push.ts';

const enc = new TextEncoder();
const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
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

const decrypt = async (body: Uint8Array, userPrivate: CryptoKey, auth: Uint8Array, userPublic: Uint8Array): Promise<string> => {
  const salt = body.slice(0, 16);
  const idlen = body[20];
  const serverPublic = body.slice(21, 21 + idlen);
  const header = body.slice(0, 21 + idlen);
  const ciphertext = body.slice(21 + idlen);
  const serverKey = await crypto.subtle.importKey('raw', serverPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: serverKey } as unknown as SubtleCryptoDeriveKeyAlgorithm, userPrivate, 256),
  );
  const prk = await hmac(auth, shared);
  const ikm = await hmac(prk, concat(enc.encode('WebPush: info\0'), userPublic, serverPublic, new Uint8Array([1])));
  const prk2 = await hmac(salt, ikm);
  const cek = (await hmac(prk2, concat(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk2, concat(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['decrypt']);
  const plain = new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce, additionalData: header, tagLength: 128 }, aesKey, ciphertext),
  );
  return new TextDecoder().decode(plain.slice(0, -1));
};

let pass = 0;
let fail = 0;
const check = async (name: string, fn: () => Promise<void> | void) => {
  try {
    await fn();
    pass++;
    console.log(`  ok ${name}`);
  } catch (err) {
    fail++;
    console.log(`  FAIL ${name}: ${(err as Error).message}`);
  }
};

console.log('[1] Web Push aes128gcm round trip');
await check('encrypts a payload the subscription can decrypt', async () => {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
  const userPublic = new Uint8Array((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer);
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const payload = JSON.stringify({ title: 'SmartBoard AI', body: 'درسك جاهز' });
  const { body } = await encryptPayload(payload, bytesToB64url(userPublic), bytesToB64url(auth));
  const decrypted = await decrypt(body, pair.privateKey, auth, userPublic);
  if (decrypted !== payload) throw new Error('payload mismatch');
});

console.log('[2] VAPID');
await check('builds an ES256 VAPID header', async () => {
  const { privateKey, publicKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', privateKey);
  const raw = new Uint8Array((await crypto.subtle.exportKey('raw', publicKey)) as ArrayBuffer);
  const env = {
    VAPID_PRIVATE_KEY: JSON.stringify(jwk),
    VAPID_PUBLIC_KEY: bytesToB64url(raw),
    VAPID_SUBJECT: 'mailto:test@example.com',
  } as never;
  const header = await vapidAuthorization('https://fcm.googleapis.com/wp/abc', env);
  if (!header.startsWith('vapid t=')) throw new Error('bad scheme');
  const jwt = header.slice('vapid t='.length).split(', k=')[0];
  if (jwt.split('.').length !== 3) throw new Error('bad JWT');
});

console.log('[3] endpoint allowlist');
await check('accepts a known push service', () => {
  validateEndpoint('https://fcm.googleapis.com/wp/abc');
});
await check('rejects http and unknown hosts', () => {
  let rejected = 0;
  for (const url of ['http://fcm.googleapis.com/wp/abc', 'https://evil.example/push']) {
    try {
      validateEndpoint(url);
    } catch {
      rejected++;
    }
  }
  if (rejected !== 2) throw new Error('allowlist did not reject');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
