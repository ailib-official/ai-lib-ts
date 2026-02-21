/**
 * Model routing types - capabilities, pricing, performance, model info.
 * Aligned with ai-lib-python routing/types.py
 */

export type SpeedTier = 'fast' | 'balanced' | 'slow';
export type QualityTier = 'basic' | 'good' | 'excellent';

export interface ModelCapabilities {
  chat?: boolean;
  codeGeneration?: boolean;
  multimodal?: boolean;
  functionCalling?: boolean;
  toolUse?: boolean;
  multilingual?: boolean;
  contextWindow?: number;
  embedding?: boolean;
  streaming?: boolean;
}

export interface PricingInfo {
  inputCostPer1k: number;
  outputCostPer1k: number;
  currency?: string;
}

export interface PerformanceMetrics {
  speed?: SpeedTier;
  quality?: QualityTier;
  avgResponseTimeMs?: number;
  throughputTps?: number;
}

export interface ModelInfo {
  name: string;
  displayName?: string;
  description?: string;
  provider?: string;
  capabilities?: ModelCapabilities;
  pricing?: PricingInfo;
  performance?: PerformanceMetrics;
  metadata?: Record<string, string>;
}

export interface ModelEndpoint {
  name: string;
  modelName: string;
  url: string;
  weight?: number;
  healthy?: boolean;
  connectionCount?: number;
}

export interface HealthCheckConfig {
  endpoint?: string;
  intervalSeconds?: number;
  timeoutSeconds?: number;
  maxFailures?: number;
}

const CAPABILITY_MAP: Record<string, (c: ModelCapabilities) => boolean> = {
  chat: (c) => c.chat ?? true,
  code_generation: (c) => c.codeGeneration ?? false,
  code: (c) => c.codeGeneration ?? false,
  multimodal: (c) => c.multimodal ?? false,
  vision: (c) => c.multimodal ?? false,
  function_calling: (c) => c.functionCalling ?? false,
  functions: (c) => c.functionCalling ?? false,
  tool_use: (c) => c.toolUse ?? false,
  tools: (c) => (c.toolUse ?? false) || (c.functionCalling ?? false),
  multilingual: (c) => c.multilingual ?? false,
  embedding: (c) => c.embedding ?? false,
  embeddings: (c) => c.embedding ?? false,
  streaming: (c) => c.streaming ?? true,
  stream: (c) => c.streaming ?? true,
};

/**
 * Check if capabilities support a given capability name
 */
export function supportsCapability(caps: ModelCapabilities | undefined, capability: string): boolean {
  if (!caps) return false;
  const fn = CAPABILITY_MAP[capability.toLowerCase()];
  return fn ? fn(caps) : false;
}

/**
 * Check if model supports a capability
 */
export function modelSupports(model: ModelInfo, capability: string): boolean {
  return supportsCapability(model.capabilities, capability);
}
