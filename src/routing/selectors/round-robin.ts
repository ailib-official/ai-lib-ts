/**
 * Round-robin model selector
 */

import type { ModelInfo } from '../types.js';
import type { ModelSelector } from './types.js';

export class RoundRobinSelector implements ModelSelector {
  private index = 0;

  select(models: ModelInfo[]): ModelInfo | null {
    if (models.length === 0) return null;
    const model = models[this.index % models.length];
    this.index++;
    return model ?? null;
  }
}
