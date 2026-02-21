/**
 * Model array for load balancing across multiple endpoints.
 * Supports A/B testing and failover scenarios.
 * Aligned with ai-lib-python routing/manager.py ModelArray
 */

import type { ModelEndpoint, HealthCheckConfig } from './types.js';
import {
  createEndpointSelector,
  type EndpointSelector,
  type LoadBalancingStrategy,
} from './selectors/index.js';

export interface ModelArrayOptions {
  strategy?: LoadBalancingStrategy;
  healthCheck?: HealthCheckConfig;
}

export class ModelArray {
  readonly name: string;
  private readonly endpoints: ModelEndpoint[] = [];
  private strategy: LoadBalancingStrategy;
  private selector: EndpointSelector;
  readonly healthCheck: Required<HealthCheckConfig>;

  constructor(name: string, options: ModelArrayOptions = {}) {
    this.name = name;
    this.strategy = options.strategy ?? 'round_robin';
    this.selector = createEndpointSelector(this.strategy);
    this.healthCheck = {
      endpoint: options.healthCheck?.endpoint ?? '/health',
      intervalSeconds: options.healthCheck?.intervalSeconds ?? 30,
      timeoutSeconds: options.healthCheck?.timeoutSeconds ?? 5,
      maxFailures: options.healthCheck?.maxFailures ?? 3,
    };
  }

  addEndpoint(endpoint: ModelEndpoint): this {
    const ep: ModelEndpoint = {
      ...endpoint,
      healthy: endpoint.healthy ?? true,
      weight: endpoint.weight ?? 1,
      connectionCount: endpoint.connectionCount ?? 0,
    };
    this.endpoints.push(ep);
    return this;
  }

  removeEndpoint(endpointName: string): ModelEndpoint | undefined {
    const idx = this.endpoints.findIndex((e) => e.name === endpointName);
    if (idx >= 0) {
      const [removed] = this.endpoints.splice(idx, 1);
      return removed;
    }
    return undefined;
  }

  getEndpoint(endpointName: string): ModelEndpoint | undefined {
    return this.endpoints.find((e) => e.name === endpointName);
  }

  withStrategy(strategy: LoadBalancingStrategy): this {
    this.strategy = strategy;
    this.selector = createEndpointSelector(strategy);
    return this;
  }

  selectEndpoint(): ModelEndpoint | null {
    return this.selector.select(this.endpoints);
  }

  markHealthy(endpointName: string): boolean {
    const ep = this.getEndpoint(endpointName);
    if (ep) {
      ep.healthy = true;
      return true;
    }
    return false;
  }

  markUnhealthy(endpointName: string): boolean {
    const ep = this.getEndpoint(endpointName);
    if (ep) {
      ep.healthy = false;
      return true;
    }
    return false;
  }

  isHealthy(): boolean {
    return this.endpoints.some((e) => e.healthy !== false);
  }

  healthyEndpoints(): ModelEndpoint[] {
    return this.endpoints.filter((e) => e.healthy !== false);
  }

  get currentStrategy(): LoadBalancingStrategy {
    return this.strategy;
  }

  get size(): number {
    return this.endpoints.length;
  }
}
