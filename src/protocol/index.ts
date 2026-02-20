/**
 * Protocol module - handles loading, validating, and managing AI-Protocol specifications
 *
 * @module protocol
 */

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
} from './manifest.js';

export { ProtocolLoader, createLoader } from './loader.js';
export type { ProtocolLoaderOptions } from './loader.js';
export { ProtocolValidator, getValidator, validateProvider, validateModels } from './validator.js';
