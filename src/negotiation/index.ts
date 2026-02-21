/**
 * Negotiation module - fallback chains and parallel execution
 */

export { FallbackChain } from './fallback-chain.js';
export type {
  FallbackTarget,
  FallbackConfig,
  FallbackResult,
} from './fallback-chain.js';

export { firstSuccess, parallelAll } from './parallel.js';
export type { ParallelResult } from './parallel.js';
