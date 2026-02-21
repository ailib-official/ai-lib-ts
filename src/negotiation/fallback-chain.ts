/**
 * Fallback chain for multi-model degradation.
 * Aligned with ai-lib-python resilience/fallback.py
 */

import { AiLibError, isFallbackable } from '../errors/index.js';
import type { StandardErrorCodeType } from '../errors/index.js';

export interface FallbackTarget<T> {
  name: string;
  operation: () => Promise<T>;
  weight?: number;
  enabled?: boolean;
}

export interface FallbackConfig {
  retryAll?: boolean;
  maxAttemptsPerTarget?: number;
  delayBetweenTargetsMs?: number;
}

export interface FallbackResult<T> {
  success: boolean;
  value?: T;
  targetUsed?: string;
  targetsTried: string[];
  errors: Record<string, Error>;
}

function shouldFallback(error: unknown): boolean {
  if (error instanceof AiLibError) {
    return error.fallbackable;
  }
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return isFallbackable((error as { code: StandardErrorCodeType }).code);
  }
  return false;
}

/**
 * Fallback chain for automatic failover between multiple targets
 */
export class FallbackChain<T = unknown> {
  private readonly config: Required<FallbackConfig>;
  private readonly targets: FallbackTarget<T>[] = [];

  constructor(config: FallbackConfig = {}) {
    this.config = {
      retryAll: config.retryAll ?? true,
      maxAttemptsPerTarget: config.maxAttemptsPerTarget ?? 1,
      delayBetweenTargetsMs: config.delayBetweenTargetsMs ?? 0,
    };
  }

  addTarget(
    name: string,
    operation: () => Promise<T>,
    options?: { weight?: number; enabled?: boolean }
  ): this {
    this.targets.push({
      name,
      operation,
      weight: options?.weight ?? 1,
      enabled: options?.enabled ?? true,
    });
    return this;
  }

  removeTarget(name: string): boolean {
    const idx = this.targets.findIndex((t) => t.name === name);
    if (idx >= 0) {
      this.targets.splice(idx, 1);
      return true;
    }
    return false;
  }

  setEnabled(name: string, enabled: boolean): boolean {
    const target = this.targets.find((t) => t.name === name);
    if (target) {
      target.enabled = enabled;
      return true;
    }
    return false;
  }

  getTargets(): string[] {
    return [...this.targets]
      .filter((t) => t.enabled !== false)
      .sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1))
      .map((t) => t.name);
  }

  /**
   * Execute through fallback chain - tries each target in order until one succeeds
   */
  async execute(options?: {
    onFallback?: (from: string, to: string, error: Error) => void;
  }): Promise<FallbackResult<T>> {
    const sorted = [...this.targets]
      .filter((t) => t.enabled !== false)
      .sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1));

    if (sorted.length === 0) {
      return {
        success: false,
        targetsTried: [],
        errors: { _chain: new Error('No enabled targets in chain') },
      };
    }

    const errors: Record<string, Error> = {};
    const targetsTried: string[] = [];
    let lastTarget: string | undefined;

    for (const target of sorted) {
      targetsTried.push(target.name);

      for (let attempt = 0; attempt < this.config.maxAttemptsPerTarget; attempt++) {
        try {
          const result = await target.operation();
          return {
            success: true,
            value: result,
            targetUsed: target.name,
            targetsTried,
            errors,
          };
        } catch (e) {
          const err = e instanceof Error ? e : new Error(String(e));
          errors[target.name] = err;

          if (!shouldFallback(err)) {
            return { success: false, targetsTried, errors };
          }

          if (attempt < this.config.maxAttemptsPerTarget - 1) {
            continue;
          }
          break;
        }
      }

      if (options?.onFallback && lastTarget) {
        const nextIdx = sorted.indexOf(target) + 1;
        const nextTarget = nextIdx < sorted.length ? sorted[nextIdx] : null;
        if (nextTarget) {
          options.onFallback(target.name, nextTarget.name, errors[target.name]!);
        }
      }
      lastTarget = target.name;

      if (this.config.delayBetweenTargetsMs > 0) {
        await sleep(this.config.delayBetweenTargetsMs);
      }
    }

    return { success: false, targetsTried, errors };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
