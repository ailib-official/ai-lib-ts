/**
 * Retry policy with exponential backoff and jitter.
 * Aligned with AI-Protocol retry_policy specification.
 */

import type { RetryPolicy as ProtocolRetryPolicy } from '../protocol/manifest.js';
import { AiLibError, isRetryable } from '../errors/index.js';

export type JitterStrategy = 'none' | 'full' | 'half';

export interface RetryConfig {
  maxRetries?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  jitter?: JitterStrategy;
  retryOnStatus?: number[];
  exponentialBase?: number;
}

export interface RetryResult<T> {
  success: boolean;
  value?: T;
  error?: Error;
  attempts: number;
  totalDelayMs: number;
}

const DEFAULT_RETRY_ON_STATUS = [429, 500, 502, 503, 504];

/**
 * Create RetryConfig from protocol retry_policy
 */
export function retryConfigFromProtocol(policy: ProtocolRetryPolicy | undefined): RetryConfig {
  if (!policy) {
    return { maxRetries: 3, minDelayMs: 1000, maxDelayMs: 60000, jitter: 'full' };
  }
  const jitter = policy.jitter === 'none' || policy.jitter === 'half' ? policy.jitter : 'full';
  return {
    maxRetries: policy.max_retries ?? 3,
    minDelayMs: policy.min_delay_ms ?? 1000,
    maxDelayMs: policy.max_delay_ms ?? 60000,
    jitter,
    retryOnStatus: policy.retry_on_http_status ?? DEFAULT_RETRY_ON_STATUS,
    exponentialBase: 2,
  };
}

/**
 * Retry policy with exponential backoff and jitter
 */
export class RetryPolicy {
  private readonly config: Required<RetryConfig>;

  constructor(config: RetryConfig = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      minDelayMs: config.minDelayMs ?? 1000,
      maxDelayMs: config.maxDelayMs ?? 60000,
      jitter: config.jitter ?? 'full',
      retryOnStatus: config.retryOnStatus ?? DEFAULT_RETRY_ON_STATUS,
      exponentialBase: config.exponentialBase ?? 2,
    };
  }

  /**
   * Calculate delay for a retry attempt
   */
  calculateDelay(attempt: number, retryAfterMs?: number): number {
    if (retryAfterMs != null && retryAfterMs > 0) {
      return retryAfterMs / 1000;
    }
    const baseDelayMs = Math.min(
      this.config.minDelayMs * Math.pow(this.config.exponentialBase, attempt),
      this.config.maxDelayMs
    );
    if (this.config.jitter === 'none') {
      return baseDelayMs / 1000;
    }
    const jitterRange = this.config.jitter === 'full' ? baseDelayMs : baseDelayMs / 2;
    const delayMs = baseDelayMs - jitterRange / 2 + Math.random() * jitterRange;
    return delayMs / 1000;
  }

  /**
   * Check if an error should trigger a retry
   */
  shouldRetry(error: Error, attempt: number): boolean {
    if (attempt >= this.config.maxRetries) return false;
    if (error instanceof AiLibError) {
      return isRetryable(error.code);
    }
    if (this.config.retryOnStatus.length > 0 && 'httpStatus' in error) {
      const status = (error as AiLibError).httpStatus;
      if (status != null) {
        return this.config.retryOnStatus.includes(status);
      }
    }
    return false;
  }

  /**
   * Execute an operation with retry
   */
  async execute<T>(
    operation: () => Promise<T>,
    onRetry?: (attempt: number, error: Error, delaySeconds: number) => void
  ): Promise<RetryResult<T>> {
    let lastError: Error | undefined;
    let totalDelayMs = 0;
    let attempt = 0;

    while (true) {
      try {
        const result = await operation();
        return {
          success: true,
          value: result,
          attempts: attempt + 1,
          totalDelayMs,
        };
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        attempt++;

        if (!this.shouldRetry(lastError, attempt - 1)) {
          return {
            success: false,
            error: lastError,
            attempts: attempt,
            totalDelayMs,
          };
        }

        const delaySeconds = this.calculateDelay(attempt - 1);
        totalDelayMs += delaySeconds * 1000;

        if (onRetry) {
          onRetry(attempt, lastError, delaySeconds);
        }

        await sleep(delaySeconds * 1000);
      }
    }
  }
}

/**
 * Execute operation with retry, throwing on failure
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config?: RetryConfig,
  onRetry?: (attempt: number, error: Error, delaySeconds: number) => void
): Promise<T> {
  const policy = new RetryPolicy(config);
  const result = await policy.execute(operation, onRetry);
  if (result.success && result.value !== undefined) {
    return result.value;
  }
  throw result.error ?? new Error('Retry failed');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
