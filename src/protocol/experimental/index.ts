/**
 * Experimental protocol consume surface (ALT-EXP-001 / Facade evidence).
 * Schemas remain status: experimental — not a stable Facade export.
 */

export type {
  AssembleStrategy,
  CapabilityTag,
  CapabilityTagMapping,
  CapabilityTagMappingEntry,
  ContextEnvelope,
  ContextLayer,
  MessageChunk,
  MessageRole,
  ProviderCapabilityName,
  TagWireRelation,
} from './types.js';

export {
  CAPABILITY_TAG_MAPPING_SCHEMA_VERSION,
  CONTEXT_ENVELOPE_SCHEMA_VERSION,
  isCriticalLayer,
} from './types.js';

export {
  loadCapabilityTagMappingFixture,
  loadContextEnvelopeFixture,
  parseCapabilityTagMapping,
  parseContextEnvelope,
} from './validate.js';

export type { ExperimentalSchemaId } from './validate.js';
