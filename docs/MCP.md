# MCP Server — SmartBoard AI

The worker exposes a **Streamable HTTP MCP** endpoint at `/mcp`. It uses JSON-RPC
2.0 and the `2024-11-05` protocol.

## Connect

### Claude Desktop / Cursor / any MCP client

```json
{
  "mcpServers": {
    "smartboard": {
      "url": "http://localhost:8787/mcp",
      "headers": {
        "Authorization": "Bearer sb_live_..."
      }
    }
  }
}
```

Create the key in the app: **Plan → API keys → Create key**, or:

```bash
curl -X POST http://localhost:8787/v1/api-keys \
  -H 'Content-Type: application/json' \
  -b 'sb_session=...' \
  -d '{"name":"Cursor"}'
```

## Tools

| Tool | Input | Output |
| :--- | :--- | :--- |
| `smartboard_health` | — | API/D1 status, user, workspace, plan |
| `smartboard_list_models` | — | Model ids, tiers, provider availability |
| `smartboard_generate_lesson` | `prompt`, `lang?`, `mode?`, `extended?` | `{provider, model, title, errors, script}` |
| `smartboard_save_lesson` | `script`, `title?`, `lang?` | `{ok, lesson}` |
| `smartboard_list_lessons` | `limit?` | `{lessons}` |
| `smartboard_get_lesson` | `id` | `{lesson}` |
| `smartboard_usage` | — | Plan limits and today's usage |

`smartboard_generate_lesson` uses OmniRouter (`auto`): FreeLLMAPI → premium →
Workers AI → Pollinations → deterministic offline builder. The returned script
is parsed, sanitised (invented colours → `ink`), and validated.

## Example session

```bash
# 1. Initialize
curl -s -X POST http://localhost:8787/mcp \
  -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'

# 2. List tools
curl -s -X POST http://localhost:8787/mcp \
  -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# 3. Generate
curl -s -X POST http://localhost:8787/mcp \
  -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{
    "name":"smartboard_generate_lesson",
    "arguments":{"prompt":"Teach photosynthesis to a 12-year-old","lang":"en"}
  }}'

# 4. Save
curl -s -X POST http://localhost:8787/mcp \
  -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{
    "name":"smartboard_save_lesson",
    "arguments":{"script":{...}}
  }}'
```

## Response shape

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [{ "type": "text", "text": "{\n  \"provider\": \"pollinations\",\n  ...\n}" }],
    "isError": false
  }
}
```

Tool errors use `isError: true` with a text explanation. Protocol errors use
JSON-RPC codes: `-32600` invalid request, `-32601` method not found, `-32602`
unknown tool / bad params, `-32700` parse error.

## Security

- API key required; the key's workspace is the tenant.
- Plan caps apply: daily AI turns, saved lessons, API keys.
- Suspended users and revoked keys fail immediately.
- The MCP server never exposes raw provider keys.
- Generated scripts are validated before they can be saved.

## Limitations

- The transport is request/response, not a long-lived SSE session. Each POST is
  independent; clients that require server-initiated notifications need a
  future `/mcp/sse` endpoint.
- No OAuth authorization server yet. Use API keys.
- Tool calls are synchronous; a long generation can take 30–60 s. Set client
  timeouts accordingly.
