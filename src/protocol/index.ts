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
  ResponsePathsConfig,
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
  FeatureFlags,
  StructuredCapabilities,
} from './manifest.js';

export { getValueAtPath, getStringAtPath } from './jsonPath.js';
export { ProtocolLoader, createLoader } from './loader.js';
export type { ProtocolLoaderOptions } from './loader.js';
export { ProtocolValidator, getValidator, validateProvider, validateModels } from './validator.js';
export { getFeatureFlags, isFeatureEnabled, getAllCapabilities, hasCapability, normalizeUsage } from './manifest.js';

/** Experimental Envelope / Tag mapping (ALT-EXP-001) — not a stable Facade. */
export {
  CAPABILITY_TAG_MAPPING_SCHEMA_VERSION,
  CONTEXT_ENVELOPE_SCHEMA_VERSION,
  isCriticalLayer,
  loadCapabilityTagMappingFixture,
  loadContextEnvelopeFixture,
  parseCapabilityTagMapping,
  parseContextEnvelope,
} from './experimental/index.js';
export type {
  AssembleStrategy,
  CapabilityTag,
  CapabilityTagMapping,
  CapabilityTagMappingEntry,
  ContextEnvelope,
  ContextLayer,
  ExperimentalSchemaId,
  MessageChunk,
  ProviderCapabilityName,
  TagWireRelation,
} from './experimental/index.js';
