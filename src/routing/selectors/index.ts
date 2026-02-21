/**
 * Model and endpoint selectors
 */

import type { ModelEndpoint } from '../types.js';
import type {
  ModelSelector,
  EndpointSelector,
  ModelSelectionStrategy,
  LoadBalancingStrategy,
} from './types.js';
import { RoundRobinSelector } from './round-robin.js';
import { CostBasedSelector } from './cost.js';
import { QualityBasedSelector } from './quality.js';

export type { ModelSelector, EndpointSelector, ModelSelectionStrategy, LoadBalancingStrategy };

export { RoundRobinSelector, CostBasedSelector, QualityBasedSelector };

/** Create model selector for given strategy */
export function createModelSelector(strategy: ModelSelectionStrategy): ModelSelector {
  switch (strategy) {
    case 'cost_based':
      return new CostBasedSelector();
    case 'quality_based':
      return new QualityBasedSelector();
    case 'round_robin':
    default:
      return new RoundRobinSelector();
  }
}

/** Create endpoint selector for given strategy */
export function createEndpointSelector(_strategy: LoadBalancingStrategy): EndpointSelector {
  return new RoundRobinEndpointSelector();
}

/** Round-robin endpoint selector (healthy endpoints only) */
class RoundRobinEndpointSelector implements EndpointSelector {
  private index = 0;

  select(endpoints: ModelEndpoint[]): ModelEndpoint | null {
    const healthy = endpoints.filter((e) => e.healthy !== false);
    if (healthy.length === 0) return null;
    const ep = healthy[this.index % healthy.length];
    this.index++;
    return ep ?? null;
  }
}
