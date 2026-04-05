/**
 * E/P boundary — execution result types (Paper1 section 3.1–3.2).
 *
 * The execution layer (E) returns {@link ExecutionResult} with {@link ExecutionMetadata}.
 * The contact / policy layer (P) consumes metadata for routing, retry, and degradation.
 *
 * Micro-retry (E-only, bounded): E MAY perform at most 1–2 automatic retries for
 * transient transport failures before surfacing an error to P. E MUST NOT implement
 * cross-provider fallback or policy-driven retry loops.
 */

import type { StandardErrorCodeType } from '../errors/index.js';

/** Token usage aligned with driver usage fields (all optional per schema; partial responses allowed). */
export interface ExecutionUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  reasoning_tokens?: number;
  cache_read_tokens?: number;
  cache_creation_tokens?: number;
}

/** Metadata returned with every E-layer call for P-layer policy decisions. */
export interface ExecutionMetadata {
  provider_id: string;
  model_id: string;
  execution_latency_ms: number;
  translation_latency_ms: number;
  /** Count of micro-retries (bounded, transport-level) attempted inside E. */
  micro_retry_count: number;
  error_code?: StandardErrorCodeType;
  usage?: ExecutionUsage;
}

/** Successful execution envelope from E: payload plus metadata for P. */
export interface ExecutionResult<T> {
  data: T;
  metadata: ExecutionMetadata;
}
