# ai-lib-ts v0.3.0 Release Notes

**Release Date**: 2026-02-21

## Summary

v0.3.0 completes the 9-iteration alignment plan with ai-lib-python and ai-lib-rust runtimes. The TypeScript runtime now provides feature parity in resilience, routing, multimodal, negotiation, extras, protocol V2, streaming cancellation, plugins, and MCP tool bridging.

## New Modules

### Resilience
- **RetryPolicy**: Exponential backoff, jitter, protocol-driven config
- **CircuitBreaker**: Fault isolation (closed → open → half-open)
- **RateLimiter**: Token bucket (fromRps, fromRpm, unlimited)
- **Backpressure**: Semaphore-based concurrency limiting
- Integrated into HttpTransport via optional ResilienceConfig

### Routing
- **ModelManager**: Model registration, selection, capability filtering
- **CostBasedSelector**, **QualityBasedSelector**, **RoundRobinSelector**
- **ModelArray**: Load balancing across endpoints (health-aware)
- **modelSupports**, **recommendFor**

### Negotiation
- **FallbackChain**: Sequential failover with fallbackable error detection
- **firstSuccess**: Parallel execution, return first success
- **parallelAll**: Aggregate all results

### Multimodal
- **SttClient**: Speech-to-text (OpenAI Whisper–style API)
- **TtsClient**: Text-to-speech
- **RerankerClient**: Document relevance scoring (Cohere-style)
- **ContentBlock**: VideoBlock, OmniBlock extensions

### Extras
- **EmbeddingClient**: OpenAI-style embeddings API
- **MemoryCache**: TTL + LRU in-memory cache
- **jsonObjectConfig**, **jsonSchemaConfig**, **toOpenAIResponseFormat**
- **estimateTokens**, **estimateCost**

### Protocol V2
- **ManifestV2** types (three-ring structure)
- **parseManifestV2**, **loadManifestV2FromUrl**, **loadManifestV2FromPath**

### Streaming
- **CancelHandle**: Abort streaming via `cancel()`
- **executeStreamWithCancel()**: Returns `{ stream, cancelHandle }`
- Transport `executeStream` accepts optional `AbortSignal`

### Plugins
- **PluginRegistry**: Plugin lifecycle, request/response processing
- **HookManager**: Event-driven hooks (pre_request, post_response, etc.)

### MCP
- **McpToolBridge**: Convert MCP tools ↔ AI-Protocol ToolDefinition
- Namespace, allow/deny filters, protocol call ↔ MCP invocation mapping

## Breaking Changes

None. All additions are additive.

## Migration from v0.1.0

No migration required. New modules are opt-in. Existing code continues to work.

## Test Coverage

- 111 tests passing (6 integration tests skipped without MOCK_HTTP_URL)
- New test files: resilience, routing, negotiation, multimodal, extras, streaming, plugins, protocol-v2, mcp

## Dependencies

No new runtime dependencies. Uses native `fetch`, `FormData`, `AbortController`.

## Related

- [AI-Protocol Project Plan v4](https://github.com/ailib-official/ai-protocol) §4.4.7
- [ts_runtime_alignment_plan.md](.work/ts_runtime_alignment_plan.md)
