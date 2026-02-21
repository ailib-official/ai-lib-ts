/**
 * Quality-based model selector - selects the highest quality model
 */

import type { ModelInfo } from '../types.js';
import type { ModelSelector } from './types.js';

const QUALITY_SCORE: Record<string, number> = {
  excellent: 3,
  good: 2,
  basic: 1,
};

export class QualityBasedSelector implements ModelSelector {
  select(models: ModelInfo[]): ModelInfo | null {
    if (models.length === 0) return null;

    const qualityScore = (m: ModelInfo): number => {
      const q = m.performance?.quality ?? 'good';
      return QUALITY_SCORE[q] ?? 2;
    };

    return models.reduce((a, b) =>
      qualityScore(a) >= qualityScore(b) ? a : b
    );
  }
}
