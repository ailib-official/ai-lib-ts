/**
 * Wave-5 contact layer (P) — policy, routing, resilience, and observability.
 *
 * Import from `@ailib-official/ai-lib-ts/contact` for P-layer modules.
 * Re-exports only; no business logic in this barrel.
 */

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

export {
  RetryPolicy,
  withRetry,
  retryConfigFromProtocol,
  CircuitBreaker,
  CircuitOpenError,
  RateLimiter,
  Backpressure,
  BackpressureError,
  PreflightChecker,
  PreflightError,
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
  PreflightConfig,
  PreflightResult,
  PreflightCheckerOptions,
} from './resilience/index.js';

export { FallbackChain, firstSuccess, parallelAll } from './negotiation/index.js';
export type {
  FallbackTarget,
  FallbackConfig,
  FallbackResult,
  ParallelResult,
} from './negotiation/index.js';

export { MemoryCache } from './cache/index.js';
export type { MemoryCacheOptions } from './cache/index.js';

export {
  BatchExecutor,
  batchExecute,
  BatchCollector,
  createBatchConfig,
  batchConfigForEmbeddings,
  batchConfigForChat,
} from './batch/index.js';
export type {
  BatchResult,
  BatchExecutorOptions,
  BatchConfig,
} from './batch/index.js';

export { estimateTokens, estimateCost } from './tokens/index.js';

export { PluginRegistry, HookManager } from './plugins/index.js';
export type { Plugin, PluginContext, HookType } from './plugins/index.js';

export {
  Feedback,
  getFeedbackRequestId,
  NoopFeedbackSink,
  noopSink,
  InMemoryFeedbackSink,
  ConsoleFeedbackSink,
  CompositeFeedbackSink,
  getGlobalSink,
  setGlobalSink,
  reportFeedback,
  reportFeedbackBatch,
} from './telemetry/index.js';

export type {
  FeedbackSink,
  FeedbackEvent,
  ChoiceSelectionFeedback,
  ThumbsFeedback,
  RatingFeedback,
  TextFeedback,
  CorrectionFeedback,
  RegenerateFeedback,
  StopFeedback,
  ChoiceSelectionFeedbackBuilder,
  RatingFeedbackBuilder,
  ThumbsFeedbackBuilder,
  TextFeedbackBuilder,
  CorrectionFeedbackBuilder,
  RegenerateFeedbackBuilder,
  StopFeedbackBuilder,
} from './telemetry/index.js';

export {
  InterceptorPipeline,
  BaseInterceptor,
  createInterceptorPipeline,
  LoggingInterceptor,
  MetricsInterceptor,
  TimingInterceptor,
} from './interceptors/index.js';

export type {
  Interceptor,
  RequestContext,
  ResponseContext,
  UnifiedRequest as InterceptorRequest,
  UnifiedResponse as InterceptorResponse,
  AiLibError as InterceptorError,
} from './interceptors/index.js';

export {
  Guardrails,
  GuardrailsConfig,
  GuardrailsConfigBuilder,
  KeywordFilter,
  PatternFilter,
  PiiDetector,
  FilterAction,
  FilterRule,
} from './guardrails/index.js';

export type {
  CheckResult,
  Violation,
  ViolationType,
  ContentFilter,
} from './guardrails/index.js';

export {
  HttpTransport,
  createTransport,
  MOCK_SERVER_URL,
} from './transport/index.js';

export type {
  TransportOptions,
  CallStats,
  TransportResponse,
  ResilienceConfig,
} from './transport/index.js';

/** Experimental Context Envelope / Tag mapping (ALT-EXP-001) — Facade evidence only. */
export {
  CAPABILITY_TAG_MAPPING_SCHEMA_VERSION,
  CONTEXT_ENVELOPE_SCHEMA_VERSION,
  isCriticalLayer,
  loadCapabilityTagMappingFixture,
  loadContextEnvelopeFixture,
  parseCapabilityTagMapping,
  parseContextEnvelope,
} from './protocol/experimental/index.js';
export type {
  AssembleStrategy,
  CapabilityTag,
  CapabilityTagMapping,
  CapabilityTagMappingEntry,
  ContextEnvelope,
  ContextLayer,
  MessageChunk,
  ProviderCapabilityName,
  TagWireRelation,
} from './protocol/experimental/index.js';
