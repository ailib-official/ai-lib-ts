# ai-lib-ts

**Protocol runtime for [AI-Protocol](https://github.com/ailib-official/ai-protocol)** — TypeScript / Node.js reference implementation (v**1.2.0**).

[中文文档](README_CN.md)

`@ailib-official/ai-lib-ts` ships three entry points:

| Import | Layer | Use when |
|--------|-------|----------|
| `@ailib-official/ai-lib-ts` | E + P facade | Full SDK (default) |
| `@ailib-official/ai-lib-ts/core` | Execution only | Edge / minimal bundle — no resilience routing |
| `@ailib-official/ai-lib-ts/contact` | Policy only | Retry, circuit breaker, routing — no `AiClient` |

Published on [npm](https://www.npmjs.com/package/@ailib-official/ai-lib-ts) as **`@ailib-official/ai-lib-ts@1.2.0`**. Optional peer: `@ailib-official/ai-protocol@^1.0.0`.

> **Note:** Git `main` may include protocol identity and Experimental Envelope work landed after the last npm cut. Match dependency versions to the tag you intend; see [CHANGELOG](CHANGELOG.md) `Unreleased`.

## How it works

**Default chat path:** `AiClient` loads a provider manifest → builds the request from manifest fields → sends HTTP via **P-layer `HttpTransport`** (retry always on) → parses JSON / SSE with manifest `response_paths` and OpenAI-style fallbacks.

This is **not** the low-level `Pipeline` operator path (that API exists for compliance / advanced use, but `AiClient` does **not** call `Pipeline.process()` for chat). There is **no** `ProviderDriver` in this runtime.

| Layer | Modules | Responsibility |
|-------|---------|----------------|
| Execution (E) | `client`, `protocol`, `transport/http`, `pipeline`, `types`, `structured`, `mcp`, embeddings/STT/TTS/rerank | HTTP, parsing, types |
| Policy (P) | `resilience`, `routing`, `cache`, `batch`, `telemetry`, `guardrails`, `transport` (wrapper) | Retry, limits, routing — partially auto on default transport |
| Facade | package root | Re-exports both layers |

## Quick start

```bash
npm install @ailib-official/ai-lib-ts
export OPENAI_API_KEY="your-key"
```

```typescript
import { AiClient, Message } from '@ailib-official/ai-lib-ts';

const client = await AiClient.new('openai/gpt-4o');

const response = await client
  .chat([
    Message.system('You are a helpful assistant.'),
    Message.user('Hello!'),
  ])
  .execute();

console.log(response.content);
```

### Mock server (integration tests)

```typescript
import { Message, createClientBuilder } from '@ailib-official/ai-lib-ts';

const client = await createClientBuilder()
  .withMockServer('http://localhost:4010')
  .build('openai/gpt-4o');

const response = await client
  .chat([Message.user('Hello!')])
  .execute();
```

Requires a running [ai-protocol-mock](https://github.com/ailib-official/ai-protocol-mock). Env-based mock URL override (`MOCK_HTTP_URL`) is honored by transport only when `AILIB_ALLOW_MOCK_URL=1` or `NODE_ENV=test`. Explicit `withMockServer` / `baseUrlOverride` always wins.

Pattern source: `tests/integration.test.ts`.

### Streaming

```typescript
const stream = client
  .chat([Message.user('Count from 1 to 5')])
  .stream()
  .executeStream();

for await (const event of stream) {
  if (event.event_type === 'PartialContentDelta') {
    process.stdout.write(event.content);
  }
}
```

### Tool calling

```typescript
const response = await client
  .chat([Message.user("What's the weather in Tokyo?")])
  .tools([
    {
      name: 'get_weather',
      description: 'Get weather',
      parameters: {
        type: 'object',
        properties: { city: { type: 'string' } },
        required: ['city'],
      },
    },
  ])
  .execute();

for (const call of response.toolCalls ?? []) {
  console.log(call.name, call.arguments);
}
```

## Public API (package root)

Major exports:

- **Client:** `AiClient`, `AiClientBuilder`, `createClient`, `createClientBuilder`, `ChatBuilder`
- **Types:** `Message`, `ContentBlock`, `StreamingEvent`, `Tool`, execution metadata types
- **Errors:** `AiLibError`, `StandardErrorCode`, `isRetryable`, `isFallbackable`
- **Protocol:** `ProtocolLoader`, manifest types, V2 parsers, content-block encoders
- **Pipeline (advanced):** `Pipeline`, `createPipeline` — not wired into default `AiClient`
- **Policy:** `RetryPolicy`, `CircuitBreaker`, `RateLimiter`, `Backpressure`, `ModelManager`, `FallbackChain`, …
- **Service clients:** `EmbeddingClient`, `RerankerClient`, `SttClient`, `TtsClient` (standalone HTTP; not chat-pipeline driven)
- **Extras:** `MemoryCache`, `McpToolBridge`, `Guardrails`, telemetry helpers

Use `/core` when you need E-layer only (no `RetryPolicy` on transport). Use `/contact` for policy without `AiClient`.

Text-tool helpers (`StandardTextToolParser`, `createToolCallingPolicy`, …) live under `types` and are re-exported from **`@ailib-official/ai-lib-ts/core`** (not the package-root barrel).

### Honest capability boundaries

| Area | In the package | Not included |
|------|----------------|--------------|
| **MCP** | `McpToolBridge` format conversion | MCP server transport in `AiClient` |
| **Computer Use** | V2 config types in protocol module | Runtime executor / screenshot environment |
| **Hot reload** | — | Not implemented (`ProtocolLoader.clearCache()` only) |
| **Resilience on default client** | Manifest-derived **retry** on P-layer `HttpTransport` | Circuit breaker / rate limit / backpressure unless you pass `resilience` into transport options |
| **`Pipeline`** | Public low-level API | Default `AiClient` chat path |
| **Embeddings / rerank** | `EmbeddingClient` / `RerankerClient` with `fromManifest` / `fromModel` | Silent OpenAI/Cohere host defaults (removed; ALT-EMB-001) |
| **Experimental Envelope** | Parse / validate / fixture load (ALT-EXP-001) | Layered assemble algorithm (rust `assemble_layered` remains truth) |

### Embeddings & rerank (ALT-EMB-001)

No silent vendor base URL. Prefer protocol builders:

```typescript
import { EmbeddingClient } from '@ailib-official/ai-lib-ts';

const client = await EmbeddingClient.builder().fromModel('openai/text-embedding-3-small');
const result = await client.embed('hello');
```

`fromManifest` / `fromModel` resolve credential + `base_url` + endpoint path from the manifest (`/embeddings` or `/rerank` path-only fallback). Explicit `baseUrl` / `apiKey` overrides remain available.

### Resilience (what is auto-enabled)

Default `AiClient` uses P-layer `HttpTransport`, which **always** applies manifest/default **retry** on non-streaming `execute()`.

Circuit breaker, rate limiter, and backpressure require explicit `TransportOptions.resilience` when constructing transport — `AiClientBuilder` does **not** expose `.withCircuitBreaker()` / `.withRateLimiter()` helpers.

For manual gating, use `PreflightChecker` from the policy layer beside the client.

## Protocol manifests

Resolution via `ProtocolLoader` / `AiClient.new(model, { protocolPath })`:

1. Explicit `protocolPath` (authoritative only)
2. `AI_PROTOCOL_DIR` / `AI_PROTOCOL_PATH` (authoritative) + packaged degrade paths
3. Packaged / relative defaults (`node_modules/@ailib-official/ai-protocol`, `../ai-protocol`, …)
4. GitHub raw fallback (`ailib-official/ai-protocol` `main` `dist/`)

Per root: prefer published `dist/v2|v1/providers/<id>.json`, then source YAML/JSON degrade.

**Identity / aliases (Unreleased on `main`, ALT-ID-001):** `loadProvider` resolves marketplace aliases via `dist/provider-identity.json` (multi-family map), e.g. `google` → `gemini`, `kimi` → `moonshot`. Order: exact on authoritative roots → alias → retry → degrade → GitHub dist; else fail closed.

**Experimental Envelope (Unreleased on `main`, ALT-EXP-001):** `parseContextEnvelope` / `parseCapabilityTagMapping` (+ fixture loaders, schema version constants). Status remains `experimental` — not a product routing default. TS does not re-implement layered assemble.

## API keys

1. Explicit transport / builder credential override
2. Manifest-declared env vars (`endpoint.auth` / top-level `auth`: `token_env` / `key_env` / …)
3. Conventional `<PROVIDER_ID>_API_KEY` env var

## Standard error codes (V2)

| Code | Name | Retryable | Fallbackable |
|------|------|-----------|--------------|
| E1001 | `invalid_request` | No | No |
| E1002 | `authentication` | No | Yes |
| E1003 | `permission_denied` | No | No |
| E1004 | `not_found` | No | No |
| E1005 | `request_too_large` | No | No |
| E2001 | `rate_limited` | Yes | Yes |
| E2002 | `quota_exhausted` | No | Yes |
| E3001 | `server_error` | Yes | Yes |
| E3002 | `overloaded` | Yes | Yes |
| E3003 | `timeout` | Yes | Yes |
| E4001 | `conflict` | Yes | No |
| E4002 | `cancelled` | No | No |
| E9999 | `unknown` | No | No |

## Testing

```bash
npm test
npm run test:core
npm run test:compliance:full
```

With mock server:

```bash
AILIB_ALLOW_MOCK_URL=1 MOCK_HTTP_URL=http://localhost:4010 npm test
```

Compliance (local protocol checkout):

```bash
AI_PROTOCOL_DIR=../ai-protocol COMPLIANCE_DIR=../ai-protocol/tests/compliance npm test
```

## Related

- [AI-Protocol](https://github.com/ailib-official/ai-protocol) — specification & manifests
- [ai-lib-rust](https://github.com/ailib-official/ai-lib-rust) — Rust runtime
- [ai-lib-python](https://github.com/ailib-official/ai-lib-python) — Python runtime
- [ai-lib-go](https://github.com/ailib-official/ai-lib-go) — Go runtime
- [ai-protocol-mock](https://github.com/ailib-official/ai-protocol-mock) — unified mock service

## License

Dual-licensed under [Apache-2.0](LICENSE-APACHE) or [MIT](LICENSE-MIT).
