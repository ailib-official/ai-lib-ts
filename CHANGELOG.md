# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2026-03-07

### Added

- Cross-repo generative manifest consumption regression test in `tests/protocol-v2.test.ts` for latest `ai-protocol/v2/providers/*.yaml`.

### Changed

- V2 loader now supports YAML files in `loadManifestV2FromPath`.
- V2 parser normalizes `endpoint` to `endpoints` for compatibility with latest manifest shapes.
- V2 type declarations expanded for nested multimodal schema (`input`/`output`/`omni_mode`) and top-level `endpoint`.

## [0.4.1] - 2026-02-28

### Fixed

- **Guardrails runtime init**: Replaced invalid `Object.assign(interface, ...)` usage with runtime `const` objects for `FilterRule` and `GuardrailsConfig`, resolving `ReferenceError: FilterRule is not defined`
- **Protocol loading paths**: Expanded provider/model local candidate paths and prioritized `AI_PROTOCOL_PATH`/`AI_PROTOCOL_DIR` for deterministic manifest lookup
- **Benchmark portability**: Normalized benchmark config and output paths for repo-local execution and manual workflow triggering

## [0.4.0] - 2026-02-21

### Added

- **PreflightChecker**: Unified request gating (circuit breaker + rate limiter + backpressure)
- **BatchExecutor**: Parallel execution with configurable concurrency
- **BatchCollector**: Request grouping for batch processing (BatchConfig, batchConfigForEmbeddings, batchConfigForChat)
- **Pipeline.fromManifest**: Create pipeline from protocol manifest (provider-aware decoder/mapper)
- **CircuitBreaker**: reportSuccess() and reportFailure() for PreflightChecker integration

### Changed

- README: Aligned structure and content with ai-lib-python
- README_CN.md: New Chinese README aligned with Python runtime

## [0.3.0] - 2026-02-21

### Added

- **Resilience**: RetryPolicy, CircuitBreaker, RateLimiter, Backpressure; integrated into HttpTransport
- **Routing**: ModelManager, CostBasedSelector, QualityBasedSelector, ModelArray, modelSupports
- **Negotiation**: FallbackChain, firstSuccess, parallelAll
- **Multimodal**: SttClient, TtsClient, RerankerClient; ContentBlock extensions (video, omni)
- **Extras**: EmbeddingClient, MemoryCache, jsonObjectConfig/jsonSchemaConfig, estimateTokens/estimateCost
- **Protocol V2**: ManifestV2 types, parseManifestV2, loadManifestV2FromUrl, loadManifestV2FromPath
- **Streaming**: CancelHandle, executeStreamWithCancel(), Transport AbortSignal support
- **Plugins**: PluginRegistry, HookManager
- **MCP**: McpToolBridge (MCP tools ↔ AI-Protocol ToolDefinition format)

### Changed

- HttpTransport: optional ResilienceConfig (retry, circuit breaker, rate limiter, backpressure)
- Transport executeStream: accepts optional `{ signal?: AbortSignal }` for cancellation
- ChatBuilder: new `executeStreamWithCancel()` returns `{ stream, cancelHandle }`

### Fixed

- CircuitBreaker type resolution for optional timeoutSeconds
- RetryPolicy: Array access return type in selectors

## [0.1.0] - 2026-02-XX

### Added

- Initial release: core chat, streaming, tool calling, manifest loading
- ProtocolLoader, ProtocolValidator
- HttpTransport with fetch and SSE streaming
- AiClient, AiClientBuilder, ChatBuilder
- Pipeline: Decoder, Selector, EventMapper
- Standard error codes (13 codes)
- V1 manifest support

[0.5.0]: https://github.com/hiddenpath/ai-lib-ts/releases/tag/v0.5.0
[0.4.1]: https://github.com/hiddenpath/ai-lib-ts/releases/tag/v0.4.1
[0.4.0]: https://github.com/hiddenpath/ai-lib-ts/releases/tag/v0.4.0
[0.3.0]: https://github.com/hiddenpath/ai-lib-ts/releases/tag/v0.3.0
[0.1.0]: https://github.com/hiddenpath/ai-lib-ts/releases/tag/v0.1.0
