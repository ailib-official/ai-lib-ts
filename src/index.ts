/**
 * @hiddenpath/ai-lib-ts
 *
 * Official TypeScript Runtime for AI-Protocol
 * Unified AI model interaction for Node.js and the npm ecosystem
 *
 * @packageDocumentation
 */

// Core types (values and types)
export { Message, ContentBlock, guessMediaType } from './types/index.js';
export type {
  MessageRole,
  MessageContent,
  ImageSource,
  AudioSource,
  VideoSource,
  OmniSource,
} from './types/index.js';

export { StreamingEvent, TerminationReason } from './types/index.js';
export type { TerminationReasonType } from './types/index.js';

export { Tool } from './types/index.js';
export type { ToolDefinition, ToolCall, ParsedToolCall, ToolChoice } from './types/index.js';

// Errors
export {
  AiLibError,
  ProtocolError,
  StandardErrorCode,
  Result,
  isRetryable,
  isFallbackable,
  classifyHttpStatus,
} from './errors/index.js';

export type { ErrorMeta, StandardErrorCodeType } from './errors/index.js';

// Protocol
export {
  ProtocolLoader,
  ProtocolValidator,
  createLoader,
  getValidator,
  validateProvider,
  validateModels,
} from './protocol/index.js';

export type {
  ProviderManifest,
  ModelsManifest,
  ModelEntry,
  ProtocolManifest,
  UnifiedRequest,
  UnifiedResponse,
  StreamingConfig,
  EventMapping,
  EndpointConfig,
  AuthConfig,
  ErrorClassification,
  RateLimitHeaders,
  RetryPolicy as ProtocolRetryPolicy,
  ProviderCapability,
  ModelCapability,
  ModelPricing,
  ProtocolLoaderOptions,
} from './protocol/index.js';

// Protocol V2
export {
  parseManifestV2,
  loadManifestV2FromUrl,
  loadManifestV2FromPath,
} from './protocol/v2/index.js';
export type {
  ManifestV2,
  ApiStyle,
  AuthConfigV2,
  EndpointV2,
  ModelDef,
  StreamingV2,
  McpConfig,
  ComputerUseConfig,
  MultimodalConfig,
} from './protocol/v2/index.js';

// Transport
export { HttpTransport, createTransport, MOCK_SERVER_URL } from './transport/index.js';

export type {
  TransportOptions,
  CallStats,
  TransportResponse,
  ResilienceConfig,
} from './transport/index.js';

// Routing
export {
  ModelManager,
  ModelArray,
  createModelSelector,
  createEndpointSelector,
  RoundRobinSelector,
  CostBasedSelector,
  QualityBasedSelector,
  supportsCapability,
  modelSupports,
} from './routing/index.js';

export type {
  ModelInfo,
  ModelCapabilities,
  ModelEndpoint,
  PricingInfo,
  PerformanceMetrics,
  HealthCheckConfig,
  SpeedTier,
  QualityTier,
  ModelManagerOptions,
  ModelArrayOptions,
  ModelSelector,
  EndpointSelector,
  ModelSelectionStrategy,
  LoadBalancingStrategy,
} from './routing/index.js';

// Resilience
export {
  RetryPolicy,
  withRetry,
  retryConfigFromProtocol,
  CircuitBreaker,
  CircuitOpenError,
  RateLimiter,
  Backpressure,
  BackpressureError,
} from './resilience/index.js';

export type {
  RetryConfig,
  RetryResult,
  JitterStrategy,
  CircuitBreakerConfig,
  CircuitState,
  CircuitStats,
  RateLimiterConfig,
  BackpressureConfig,
} from './resilience/index.js';

// Pipeline
export {
  Pipeline,
  createPipeline,
  createSseDecoder,
  createJsonSelector,
  createOpenAiEventMapper,
  createAnthropicEventMapper,
} from './pipeline/index.js';

export type { PipelineOperator, Decoder, Selector, EventMapper } from './pipeline/index.js';

// Client
export {
  AiClient,
  AiClientBuilder,
  ChatBuilder,
  createClient,
  createClientBuilder,
} from './client/index.js';

export type {
  ClientOptions,
  ChatOptions,
  Response,
} from './client/index.js';

// Multimodal: STT, TTS, Rerank
export { SttClient, SttClientBuilder } from './stt/index.js';
export type {
  Transcription,
  TranscriptionSegment,
  SttOptions,
  SttClientConfig,
} from './stt/index.js';

export { TtsClient, TtsClientBuilder } from './tts/index.js';
export type {
  AudioOutput,
  AudioFormat,
  TtsOptions,
  TtsClientConfig,
} from './tts/index.js';

export { RerankerClient, RerankerClientBuilder } from './rerank/index.js';
export type {
  RerankResult,
  RerankOptions,
  RerankerClientConfig,
} from './rerank/index.js';

// Negotiation
export { FallbackChain, firstSuccess, parallelAll } from './negotiation/index.js';
export type {
  FallbackTarget,
  FallbackConfig,
  FallbackResult,
  ParallelResult,
} from './negotiation/index.js';

// Extras: Embeddings, Cache, Structured, Tokens
export { EmbeddingClient, EmbeddingClientBuilder } from './embeddings/index.js';
export type { EmbeddingClientConfig, Embedding, EmbeddingUsage, EmbeddingResponse } from './embeddings/index.js';

export { MemoryCache } from './cache/index.js';
export type { MemoryCacheOptions } from './cache/index.js';

export { jsonObjectConfig, jsonSchemaConfig, toOpenAIResponseFormat } from './structured/index.js';
export type { JsonMode, JsonModeConfig } from './structured/index.js';

export { estimateTokens, estimateCost } from './tokens/index.js';

// Streaming
export { CancelHandle } from './streaming/cancel.js';

// Plugins
export { PluginRegistry, HookManager } from './plugins/index.js';
export type { Plugin, PluginContext, HookType } from './plugins/index.js';

// MCP
export { McpToolBridge } from './mcp/index.js';
export type { McpToolBridgeOptions, McpTool, McpToolInvocation, McpToolResult, McpServerSpec } from './mcp/index.js';
