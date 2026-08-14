# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added

- **ALT-GEN-002 (Experimental)**: generative L-Exec clients via `HttpTransport`
  (`ImageGenerationClient` / `SpeechToTextClient` / `TextToSpeechClient`);
  `requireGenerativeEndpoint` (omit≠false); openai/dashscope image adapters.
  Absolute L-Exec URLs supported in `HttpTransport.buildUrl`.
- **ALT-GEN-001 (Experimental)**: `supportsGenerativeForModel` (omit≠false) +
  generative request/result types under `src/generative/` (no HTTP drivers yet).

### Changed

- **ALT-TTC-012**: Lenient parse-aid accepts bare `<invoke>`/`<parameter>` (not DSML);
  L2/L3 prompts forbid those tags and no longer claim they "WILL BE IGNORED".
- **PROTO-PIN**: CI checkouts `ailib-official/ai-protocol` `29015b4` (PT-TTC-012 +
  PT-GEN-003; npm protocol still 1.2.0). Same pin class as ALP-TTC-012 / #31.

## [1.2.0] - 2026-08-07

### Milestone

- **GOV-007 Wave2 + ttc-010 parity**: Ancillary APIs via HttpTransport; DSML tool_call+JSON remaining_text strip. npm **1.2.0**. PROTO-PIN ai-protocol **v1.2.0** (d61b701).

### Changed

- **GOV-007**: Ancillary HTTP via shared HttpTransport.
- **ttc-010**: Lenient DSML-delimited tool_call wrappers with standard JSON body.


## [1.1.0] - 2026-07-31

### Changed

- Package version **1.1.0**; dependency / CI **PROTO-PIN** to `@ailib-official/ai-protocol` **1.1.0** (`v1.1.0` / `2743912`).

### Added

- **Provider identity aliases (ALT-ID-001):** `ProtocolLoader.loadProvider` resolves marketplace aliases via multi-family `dist/provider-identity.json` (exact on authoritative roots → alias → retry → degrade → GitHub dist); fail closed. Golden coverage MULTI-ALIAS-XLANG-001 (#18, #20).
- **Experimental Envelope / Tag mapping (ALT-EXP-001):** consume-only `parseContextEnvelope` / `parseCapabilityTagMapping` (+ fixture loaders, schema version constants). Status remains experimental; not a product routing default. Does not re-implement rust `assemble_layered` (#19).

### Docs

- README / README_CN aligned to public API truth at **1.1.0**.

## [1.0.1] - 2026-07-11

### Fixed

- **ALT-EMB-001 / XR-EMB**: Protocolize `EmbeddingClient` / `RerankerClient` — no silent OpenAI/Cohere host defaults; `fromManifest` / `fromModel`; path-only `/embeddings` `/rerank` fallback ([ARCH-001]).

## [1.0.0] - 2026-07-01

### Milestone

- **Wave-5 v1.0.0**: E/P subpaths stable; pins `@ailib-official/ai-protocol@1.0.0`; PT-073g sign-off.

### Changed

- Semver **1.0.0** — builds on 0.5.3 (ALT-QA-001 E/P exports, MOCK guard, CI protocol pin).

## [0.5.3] - 2026-06-30

### Added

- E/P subpath exports: `@ailib-official/ai-lib-ts/core` and `/contact` (tsup multi-entry).
- `npm run test:core` (E-only compliance) vs `npm run test:compliance:full` (full matrix).

### Fixed

- **P0 (PT-073g):** tsup multi-entry builds `dist/core.*` and `dist/contact.*`; new `src/contact.ts` P-layer barrel; E-layer `transport/http.ts` split from P-layer resilience decorators.
- **P1:** `MOCK_HTTP_URL` honored only when `AILIB_ALLOW_MOCK_URL=1` or `NODE_ENV=test`; removed hardcoded LAN mock IP default.
- **P1:** CI workflows pin `ailib-official/ai-protocol` checkout to `main` (post PT-073h #18; includes `--ts-root` EP check).
- V1 manifest `feature_flags` parsing via `getFeatureFlags()`.

## [0.5.1] - 2026-03-08

### Added

- Compliance matrix tests activated in `tests/compliance-matrix.test.ts` covering:
  - message building (`msg-*`)
  - stream decode / event mapping / tool accumulation (`str-*`)
  - request parameter mapping (`req-*`)
  - plus existing retry/loading suites.

### Changed

- Compliance baseline now executes YAML matrix parity checks against ai-protocol fixtures in regular test flows.

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

[0.5.1]: https://github.com/ailib-official/ai-lib-ts/releases/tag/v0.5.1
[0.5.0]: https://github.com/ailib-official/ai-lib-ts/releases/tag/v0.5.0
[0.4.1]: https://github.com/ailib-official/ai-lib-ts/releases/tag/v0.4.1
[0.4.0]: https://github.com/ailib-official/ai-lib-ts/releases/tag/v0.4.0
[0.3.0]: https://github.com/ailib-official/ai-lib-ts/releases/tag/v0.3.0
[0.1.0]: https://github.com/ailib-official/ai-lib-ts/releases/tag/v0.1.0
