/**
 * Selector strategy types
 */

import type { ModelInfo, ModelEndpoint } from '../types.js';

export type ModelSelectionStrategy =
  | 'round_robin'
  | 'weighted'
  | 'least_connections'
  | 'performance_based'
  | 'cost_based'
  | 'random'
  | 'quality_based';

export type LoadBalancingStrategy =
  | 'round_robin'
  | 'weighted'
  | 'least_connections'
  | 'health_based'
  | 'random';

export interface ModelSelector {
  select(models: ModelInfo[]): ModelInfo | null;
}

export interface EndpointSelector {
  select(endpoints: ModelEndpoint[]): ModelEndpoint | null;
}
