/**
 * Model manager for routing and selection.
 * Aligned with ai-lib-python routing/manager.py
 */

import type { ModelInfo } from './types.js';
import { modelSupports } from './types.js';
import {
  createModelSelector,
  type ModelSelector,
  type ModelSelectionStrategy,
} from './selectors/index.js';

export interface ModelManagerOptions {
  provider?: string;
  strategy?: ModelSelectionStrategy;
}

export class ModelManager {
  private readonly provider: string;
  private readonly models = new Map<string, ModelInfo>();
  private strategy: ModelSelectionStrategy;
  private selector: ModelSelector;

  constructor(options: ModelManagerOptions = {}) {
    this.provider = options.provider ?? '';
    this.strategy = options.strategy ?? 'round_robin';
    this.selector = createModelSelector(this.strategy);
  }

  addModel(model: ModelInfo): this {
    const m = { ...model };
    if (!m.provider && this.provider) {
      m.provider = this.provider;
    }
    this.models.set(m.name, m);
    return this;
  }

  removeModel(modelName: string): ModelInfo | undefined {
    const m = this.models.get(modelName);
    this.models.delete(modelName);
    return m;
  }

  getModel(modelName: string): ModelInfo | undefined {
    return this.models.get(modelName);
  }

  listModels(): ModelInfo[] {
    return Array.from(this.models.values());
  }

  withStrategy(strategy: ModelSelectionStrategy): this {
    this.strategy = strategy;
    this.selector = createModelSelector(strategy);
    return this;
  }

  selectModel(): ModelInfo | null {
    return this.selector.select(this.listModels());
  }

  /**
   * Recommend a model for a specific use case / capability
   */
  recommendFor(useCase: string): ModelInfo | null {
    const supported = this.filterByCapability(useCase);
    if (supported.length === 0) return null;
    return this.selector.select(supported);
  }

  filterByCapability(capability: string): ModelInfo[] {
    return this.listModels().filter((m) => modelSupports(m, capability));
  }

  filterByCost(maxCostPer1k: number): ModelInfo[] {
    return this.listModels().filter(
      (m) => m.pricing && m.pricing.inputCostPer1k <= maxCostPer1k
    );
  }

  filterByContextWindow(minTokens: number): ModelInfo[] {
    return this.listModels().filter(
      (m) =>
        m.capabilities?.contextWindow != null &&
        m.capabilities.contextWindow >= minTokens
    );
  }

  get currentStrategy(): ModelSelectionStrategy {
    return this.strategy;
  }

  get size(): number {
    return this.models.size;
  }

  has(modelName: string): boolean {
    return this.models.has(modelName);
  }
}
