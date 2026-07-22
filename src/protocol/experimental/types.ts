/**
 * Experimental Context Envelope + CapabilityTag mapping (ALT-EXP-001).
 *
 * Narrow consume of ai-protocol Experimental schemas — read/validate/adapt only.
 * Does **not** promote schema status to stable and is **not** a product routing default.
 *
 * Drift vs rust (`ai-lib-contact::context::envelope`):
 * - Same layer enum strings ↔ `ContextLayer` 0–5 (system…archive).
 * - Same strategy enums (`chat` / `code-fix`) ↔ `AssembleStrategy`.
 * - TS does **not** re-implement `assemble_layered`; rust remains assembly algorithm truth.
 * - Critical layers = system + active (HardBudget), matching rust `is_critical()`.
 */

export const CONTEXT_ENVELOPE_SCHEMA_VERSION = '0.1.0-experimental' as const;
export const CAPABILITY_TAG_MAPPING_SCHEMA_VERSION = '0.1.0-experimental' as const;

/** Layer 0–5; system+active are critical (HardBudget). */
export type ContextLayer =
  | 'system'
  | 'active'
  | 'relevant'
  | 'summary'
  | 'background'
  | 'archive';

export type AssembleStrategy = 'chat' | 'code-fix';

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface MessageChunk {
  layer: ContextLayer;
  chunk_id: string;
  timestamp?: number;
  is_summary?: boolean;
  role: MessageRole;
  content: string;
  tool_call_id?: string;
}

export interface ContextEnvelope {
  schema_version: typeof CONTEXT_ENVELOPE_SCHEMA_VERSION;
  status: 'experimental';
  strategy?: AssembleStrategy;
  budget?: {
    max_input_tokens?: number;
    reserve_output_tokens?: number;
    min_tail_messages?: number;
  };
  chunks: MessageChunk[];
}

export type ProviderCapabilityName =
  | 'text'
  | 'streaming'
  | 'vision'
  | 'audio'
  | 'video'
  | 'tools'
  | 'parallel_tools'
  | 'agentic'
  | 'reasoning'
  | 'embeddings'
  | 'structured_output'
  | 'batch'
  | 'image_generation'
  | 'computer_use'
  | 'mcp_client'
  | 'mcp_server'
  | 'stt'
  | 'tts'
  | 'rerank';

/** Route / intent tags from plans capability-mapping.md (Experimental bridge). */
export type CapabilityTag =
  | 'high-reasoning'
  | 'coding'
  | 'speed'
  | 'document_understanding'
  | 'tool_calling'
  | 'long_context';

export type TagWireRelation =
  | 'requires_any'
  | 'requires_all'
  | 'prefers'
  | 'unrelated_wire';

export interface CapabilityTagMappingEntry {
  capability_tag: CapabilityTag;
  relation: TagWireRelation;
  provider_capabilities?: ProviderCapabilityName[];
  notes?: string;
}

export interface CapabilityTagMapping {
  schema_version: typeof CAPABILITY_TAG_MAPPING_SCHEMA_VERSION;
  status: 'experimental';
  mappings: CapabilityTagMappingEntry[];
  notes?: string;
}

/** Critical layers that must fit under HardBudget (rust `ContextLayer::is_critical`). */
export function isCriticalLayer(layer: ContextLayer): boolean {
  return layer === 'system' || layer === 'active';
}
