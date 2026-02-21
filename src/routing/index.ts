/**
 * Model routing and load balancing.
 * Aligned with ai-lib-python routing module.
 */

export { ModelManager } from './model-manager.js';
export type { ModelManagerOptions } from './model-manager.js';

export { ModelArray } from './model-array.js';
export type { ModelArrayOptions } from './model-array.js';

export {
  createModelSelector,
  createEndpointSelector,
  RoundRobinSelector,
  CostBasedSelector,
  QualityBasedSelector,
} from './selectors/index.js';
export type {
  ModelSelector,
  EndpointSelector,
  ModelSelectionStrategy,
  LoadBalancingStrategy,
} from './selectors/types.js';

export type {
  ModelInfo,
  ModelCapabilities,
  ModelEndpoint,
  PricingInfo,
  PerformanceMetrics,
  HealthCheckConfig,
  SpeedTier,
  QualityTier,
} from './types.js';
export { supportsCapability, modelSupports } from './types.js';
