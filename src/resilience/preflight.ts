/**
 * Preflight checks and unified request gating.
 * Aligns with ai-lib-python resilience/preflight.py
 */

import type { CircuitBreaker } from './circuit-breaker.js';
import type { RateLimiter } from './rate-limiter.js';
import type { Backpressure } from './backpressure.js';

export class PreflightError extends Error {
  readonly component: string;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;

  constructor(
    message: string,
    component: string,
    retryable = true,
    retryAfterMs?: number
  ) {
    super(message);
    this.name = 'PreflightError';
    this.component = component;
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
  }
}

export interface PreflightConfig {
  checkRateLimiter?: boolean;
  checkCircuitBreaker?: boolean;
  checkBackpressure?: boolean;
  failFast?: boolean;
  timeoutMs?: number;
}

const DEFAULT_CONFIG: Required<PreflightConfig> = {
  checkRateLimiter: true,
  checkCircuitBreaker: true,
  checkBackpressure: true,
  failFast: true,
  timeoutMs: 30000,
};

export interface PreflightResult {
  passed: boolean;
  release: () => void;
  errors: PreflightError[];
}

export interface PreflightCheckerOptions {
  rateLimiter?: RateLimiter | null;
  circuitBreaker?: CircuitBreaker | null;
  backpressure?: Backpressure | null;
  config?: PreflightConfig;
  provider?: string;
  model?: string;
}

/**
 * Unified preflight checker for requests.
 * Performs rate limiter, circuit breaker, and backpressure checks
 * before allowing a request to proceed.
 */
export class PreflightChecker {
  private readonly rateLimiter: RateLimiter | null;
  private readonly circuitBreaker: CircuitBreaker | null;
  private readonly backpressure: Backpressure | null;
  private readonly config: Required<PreflightConfig>;
  constructor(options: PreflightCheckerOptions = {}) {
    this.rateLimiter = options.rateLimiter ?? null;
    this.circuitBreaker = options.circuitBreaker ?? null;
    this.backpressure = options.backpressure ?? null;
    this.config = { ...DEFAULT_CONFIG, ...options.config };
  }

  /**
   * Perform all preflight checks.
   * Returns result with release callback - caller MUST call release() when done.
   */
  async check(): Promise<PreflightResult> {
    const errors: PreflightError[] = [];
    let release: () => void = () => {};

    // 1. Circuit breaker (fast fail)
    if (this.config.checkCircuitBreaker && this.circuitBreaker) {
      const allowed = this.circuitBreaker.getState() !== 'open';
      if (!allowed) {
        const retryAfterMs = this.circuitBreaker.getTimeUntilRetry();
        const ms =
          retryAfterMs != null ? Math.ceil(retryAfterMs * 1000) : undefined;
        errors.push(
          new PreflightError(
            'Circuit breaker is open',
            'circuit_breaker',
            true,
            ms
          )
        );
        if (this.config.failFast) {
          return { passed: false, release, errors };
        }
      }
    }

    // 2. Rate limiter (acquire waits and consumes token)
    if (this.config.checkRateLimiter && this.rateLimiter) {
      try {
        await this.rateLimiter.acquire(1);
      } catch (e) {
        errors.push(
          new PreflightError(
            `Rate limiter check failed: ${e}`,
            'rate_limiter',
            true,
            1000
          )
        );
        if (this.config.failFast) {
          return { passed: false, release, errors };
        }
      }
    }

    // 3. Backpressure permit
    if (this.config.checkBackpressure && this.backpressure) {
      try {
        const timeoutMs = Math.max(0, this.config.timeoutMs);
        if (timeoutMs > 0) {
          await Promise.race([
            this.backpressure.acquire(),
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error('Backpressure permit timeout')),
                timeoutMs
              )
            ),
          ]);
        } else {
          await this.backpressure.acquire();
        }
        release = () => this.backpressure!.release();
      } catch (e) {
        errors.push(
          new PreflightError(
            e instanceof Error ? e.message : 'Backpressure limit reached',
            'backpressure',
            true,
            100
          )
        );
        if (this.config.failFast) {
          return { passed: false, release, errors };
        }
      }
    }

    return {
      passed: errors.length === 0,
      release,
      errors,
    };
  }

  onSuccess(): void {
    if (this.circuitBreaker) {
      this.circuitBreaker.reportSuccess();
    }
  }

  onFailure(): void {
    if (this.circuitBreaker) {
      this.circuitBreaker.reportFailure();
    }
  }
}
