/**
 * Protocol manifest types based on AI-Protocol v1 specification
 */

/**
 * Provider streaming configuration
 */
export interface StreamingConfig {
  decoder: {
    format: string;
    strategy: string;
  };
  event_map: EventMapping[];
}

/**
 * Event mapping configuration
 */
export interface EventMapping {
  match: string;
  emit: string;
  extract?: Record<string, string>;
}

/**
 * API endpoint configuration
 */
export interface EndpointConfig {
  path: string;
  method?: string;
  headers?: Record<string, string>;
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  type: 'bearer' | 'api_key' | 'header';
  header_name?: string;
  env_var?: string;
}

/**
 * Error classification configuration
 */
export interface ErrorClassification {
  by_http_status?: Record<string, string>;
  by_error_code?: Record<string, string>;
}

/**
 * Rate limit header configuration
 */
export interface RateLimitHeaders {
  requests_limit?: string;
  requests_remaining?: string;
  tokens_limit?: string;
  tokens_remaining?: string;
  retry_after?: string | null;
}

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  strategy: 'exponential_backoff' | 'fixed' | 'none';
  max_retries?: number;
  min_delay_ms?: number;
  max_delay_ms?: number;
  jitter?: 'full' | 'half' | 'none';
  retry_on_http_status?: number[];
}

/**
 * Provider capability
 */
export type ProviderCapability =
  | 'chat'
  | 'streaming'
  | 'tools'
  | 'vision'
  | 'audio'
  | 'embeddings'
  | 'batch';

/**
 * Provider manifest structure
 */
export interface ProviderManifest {
  $schema?: string;
  id: string;
  name?: string;
  protocol_version: string;
  description?: string;
  base_url?: string;
  auth?: AuthConfig;
  endpoints?: Record<string, EndpointConfig>;
  streaming?: StreamingConfig;
  error_classification?: ErrorClassification;
  rate_limit_headers?: RateLimitHeaders;
  retry_policy?: RetryPolicy;
  capabilities?: ProviderCapability[];
  default_headers?: Record<string, string>;
}

/**
 * Model capability
 */
export type ModelCapability = ProviderCapability | 'agentic' | 'reasoning';

/**
 * Model pricing information
 */
export interface ModelPricing {
  input_per_token?: number;
  output_per_token?: number;
  input_per_million?: number;
  output_per_million?: number;
}

/**
 * Model manifest entry
 */
export interface ModelEntry {
  provider: string;
  model_id: string;
  context_window?: number;
  max_output_tokens?: number;
  capabilities?: ModelCapability[];
  pricing?: ModelPricing;
  description?: string;
  deprecated?: boolean;
  replacement?: string;
}

/**
 * Models manifest structure
 */
export interface ModelsManifest {
  $schema?: string;
  models: Record<string, ModelEntry>;
}

/**
 * Combined protocol manifest (provider + model)
 */
export interface ProtocolManifest extends ProviderManifest {
  model?: ModelEntry;
  model_id: string;
}

/**
 * Unified request format for cross-provider compatibility
 */
export interface UnifiedRequest {
  model: string;
  messages: Array<{
    role: string;
    content: string | unknown[];
  }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop_sequences?: string[];
  tools?: unknown[];
  tool_choice?: string | unknown;
  response_format?: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Unified response format
 */
export interface UnifiedResponse {
  content: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  finish_reason?: string;
  model?: string;
}
