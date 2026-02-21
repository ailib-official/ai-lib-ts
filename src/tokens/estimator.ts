/**
 * Token estimation for cost calculation.
 * Simple heuristic-based estimator.
 */

/**
 * Estimate token count for text (chars / 4 heuristic for English)
 */
export function estimateTokens(text: string): number {
  if (!text || text.length === 0) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Estimate cost given pricing per 1M tokens
 */
export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  inputPerMillion: number,
  outputPerMillion: number
): number {
  return (inputTokens / 1_000_000) * inputPerMillion + (outputTokens / 1_000_000) * outputPerMillion;
}
