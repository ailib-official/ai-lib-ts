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
export type { MessageRole, MessageContent, ImageSource, AudioSource } from './types/index.js';

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
  RetryPolicy,
  ProviderCapability,
  ModelCapability,
  ModelPricing,
  ProtocolLoaderOptions,
} from './protocol/index.js';

// Transport
export { HttpTransport, createTransport, MOCK_SERVER_URL } from './transport/index.js';

export type {
  TransportOptions,
  CallStats,
  TransportResponse,
} from './transport/index.js';

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
