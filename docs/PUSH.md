# Push notifications (zero budget)

SmartBoard uses the browser **Web Push** standard, not Firebase Cloud Messaging.
There is no account, no SDK, and no monthly fee: the browser's push service
(FCM on Chrome/Android, Mozilla autopush on Firefox, Apple Push on Safari/iOS)
delivers the message, and the Worker sends it with VAPID + `aes128gcm`.

## 1. Pieces

| Piece | Where |
| :--- | :--- |
| Subscription table | `worker/migrations/0005_push.sql` |
| Encryption + VAPID | `worker/src/push.ts` |
| Routes | `GET /v1/push/public-key`, `POST/DELETE /v1/push/subscribe`, `POST /v1/push/test` |
| Browser permission + UI | `components/SettingsModal.tsx` |
| Service worker | `public/sw.js` (`push`, `notificationclick`) |
| Crypto tests | `tests/push.test.ts` |

## 2. Generate VAPID keys

```bash
npx web-push generate-vapid-keys
```

Store the public key in `VAPID_PUBLIC_KEY`. Store the private key as a Worker
secret. The private key must be the **JWK JSON** (the code imports it with
`crypto.subtle.importKey('jwk', …)`), not the raw base64url form.

```bash
npx wrangler secret put VAPID_PRIVATE_KEY --config worker/wrangler.toml
npx wrangler secret put VAPID_PUBLIC_KEY --config worker/wrangler.toml
```

Set `VAPID_SUBJECT` to a real contact, e.g. `mailto:you@example.com`.

## 3. Local development

`worker/.dev.vars` (gitignored) holds a local keypair. The public key is also
served to the browser by `/v1/push/public-key`, so the frontend never hardcodes it.

The service worker is registered only in a production build (`import.meta.env.PROD`).
To test push locally, run `npm run build` and serve `dist` (or use a staging Pages
deployment); `npm run dev` unregisters the service worker to avoid stale assets.

## 4. Browser flow

1. Teacher opens **Settings → Class notifications → Enable notifications**.
2. Browser asks for permission.
3. The page gets `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`.
4. The subscription JSON (`endpoint`, `keys.p256dh`, `keys.auth`) is posted to
   `/v1/push/subscribe` with the session cookie.
5. The Worker stores it with `org_id` and `user_id`.
6. `POST /v1/push/test` sends a test notification to the current user's devices.

## 5. Delivery rules

- Endpoints are restricted to known push services (`fcm.googleapis.com`,
  `*.push.services.mozilla.com`, `*.notify.windows.com`, `*.push.apple.com`) to
  prevent SSRF.
- `404`/`410` from the push service marks the subscription revoked.
- One bad endpoint never blocks delivery to the other devices.
- Payloads are capped by the push service (usually ~4 KB). Send a title, short
  body, URL, and tag — not a full lesson.

## 6. Platform limits

- **iOS/iPadOS:** Web Push works for home-screen web apps (PWA) on iOS 16.4+.
  Safari tabs do not receive push.
- **Permission:** the user can block notifications at any time; the UI shows
  "blocked" and does not retry automatically.
- **No background sync:** a push can open/focus the app, but it cannot run the
  full lesson generator in the background.
- **Zero-budget:** Workers free tier and the browser push service are enough for
  early classrooms. Watch the daily request limit as the school grows.

## 7. Verify

```bash
npm run test:push          # aes128gcm round trip + VAPID + endpoint allowlist
npm run typecheck:worker
curl http://localhost:8787/v1/push/public-key
```
