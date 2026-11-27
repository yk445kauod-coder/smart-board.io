# OmniRouter — provider routing for SmartBoard AI

OmniRouter is the server-side router behind `"model": "auto"`. It keeps the
lesson generator working when a provider is missing, rate-limited, or down.

## Provider chain

### Free plan

1. **FreeLLMAPI** (if `FREELLMAPI_BASE_URL` is set)
2. **Pollinations** — keyless, OpenAI-compatible
3. **Cloudflare Workers AI** — `@cf/meta/llama-3.1-8b-instruct`, binding `AI`
4. **OpenRouter free models** — if `OPENROUTER_API_KEY` is set
5. **Offline deterministic builder** — always works

### Pro / School / Enterprise

1. **FreeLLMAPI** (if configured)
2. **OpenRouter** — Gemini 2.5 Flash, Claude 3.5 Haiku
3. **Gemini** — direct Google AI Studio
4. **Anthropic** — direct
5. **DeepSeek** — direct
6. **Workers AI**
7. **Pollinations**
8. **Offline builder**

The order is intentional: paid plans get quality first; free plans get keyless
first. A school can point `FREELLMAPI_BASE_URL` at its own gateway and become
the first provider for every plan.

## Failure semantics

- **Before the first token:** try the next provider.
- **After the first token:** stop and surface the error. Falling back would
  duplicate the partial board.
- **Every provider fails:** the offline builder returns a valid 5-step protocol
  script, so the user never sees a dead end.

## FreeLLMAPI

[FreeLLMAPI](https://github.com/tashfeenahmed/freellmapi) is a self-hosted
OpenAI-compatible gateway that aggregates free providers.

1. Deploy it (Docker/Postgres per its README).
2. Create an API key in its dashboard.
3. Configure the worker:

```bash
wrangler secret put FREELLMAPI_API_KEY
```

```toml
[vars]
FREELLMAPI_BASE_URL = "https://your-freellmapi.example.com/v1"
FREELLMAPI_MODEL = "auto"
```

The adapter uses `POST {base}/chat/completions`, `Authorization: Bearer …` when
a key is set, and streams SSE. It becomes the first provider in both plan
chains. If the URL is empty, the provider is skipped without an error.

## Keyless providers

### Pollinations

- Endpoint: `https://text.pollinations.ai/openai`
- No key.
- Streaming SSE; falls back to the text endpoint if the OpenAI-compatible
  endpoint is unavailable.
- Best for the free tier and demos. Do not depend on it for paid SLAs.

### Cloudflare Workers AI

- Binding: `AI` in `worker/wrangler.toml`.
- Model: `@cf/meta/llama-3.1-8b-instruct`.
- No external key; billed through the Cloudflare account.
- More reliable than Pollinations for JSON-shaped output.

### Offline builder

- Deterministic, no network.
- Produces a valid `ProtocolScript` with a title, key idea, steps, example, and
  check-for-understanding.
- Used when all network providers fail; also useful for tests.

## Configuration

| Variable | Required | Purpose |
| :--- | :--- | :--- |
| `OPENROUTER_API_KEY` | no | OpenRouter premium/free models |
| `GEMINI_API_KEY` | no | Direct Gemini |
| `DEEPSEEK_API_KEY` | no | Direct DeepSeek |
| `ANTHROPIC_API_KEY` | no | Direct Claude |
| `FREELLMAPI_BASE_URL` | no | Self-hosted gateway base URL |
| `FREELLMAPI_API_KEY` | no | Gateway key (optional if the gateway is private) |
| `FREELLMAPI_MODEL` | no | Model name sent to the gateway; default `auto` |

## Observability

- `GET /v1/providers` — public availability.
- `GET /v1/admin/providers` — admin view with configured count.
- `runs` table — provider, model, status, latency per stream.
- The SSE `provider` event tells the client which provider produced the first
  token.

## Cost control

1. **Free first for free users.** Pollinations/Workers AI cost less than premium.
2. **Cap turns per plan.** 50 / 500 / 2,000 per day.
3. **Cap output.** `maxTokens` defaults to 6000 and is capped at 8192.
4. **Prefer JSON mode.** Providers that support `response_format` produce fewer
   retries.
5. **Watch fallback rate.** If > 5% of streams reach the offline builder, the
   free providers are unhealthy; investigate before upgrading everyone.

## Adding a provider

1. Add a `ModelDef` in `worker/src/models.ts` with `provider`, `upstream`,
   `keyEnv`, `baseUrl`, `tier`.
2. Add a branch in `worker/src/providers.ts` (`streamChat`).
3. Add availability in `worker/src/omni.ts` (`providerAvailable`) and the chain.
4. Add a row in `docs/OMNIROUTER.md` and the admin provider table picks it up
   automatically.
