/**
 * Cost-based model selector - selects the cheapest model
 */

import type { ModelInfo } from '../types.js';
import type { ModelSelector } from './types.js';

export class CostBasedSelector implements ModelSelector {
  select(models: ModelInfo[]): ModelInfo | null {
    if (models.length === 0) return null;

    const cost = (m: ModelInfo): number => {
      if (!m.pricing) return Number.POSITIVE_INFINITY;
      return m.pricing.inputCostPer1k + m.pricing.outputCostPer1k;
    };

    return models.reduce((a, b) => (cost(a) <= cost(b) ? a : b));
  }
}
