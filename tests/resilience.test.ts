/**
 * Tests for Resilience module
 */

import { describe, it, expect } from 'vitest';
import {
  RetryPolicy,
  withRetry,
  retryConfigFromProtocol,
  CircuitBreaker,
  CircuitOpenError,
  RateLimiter,
  Backpressure,
} from '../src/resilience/index.ts';
import { AiLibError } from '../src/errors/index.ts';

describe('RetryPolicy', () => {
  it('should succeed on first attempt', async () => {
    const policy = new RetryPolicy({ maxRetries: 2 });
    const result = await policy.execute(async () => 42);
    expect(result.success).toBe(true);
    expect(result.value).toBe(42);
    expect(result.attempts).toBe(1);
  });

  it('should retry and eventually succeed', async () => {
    let attempts = 0;
    const policy = new RetryPolicy({ maxRetries: 3, minDelayMs: 10, maxDelayMs: 50 });
    const result = await policy.execute(async () => {
      attempts++;
      if (attempts < 2) throw AiLibError.fromHttpStatus(503, 'fail');
      return 'ok';
    });
    expect(result.success).toBe(true);
    expect(result.value).toBe('ok');
    expect(result.attempts).toBe(2);
  });

  it('should fail after max retries', async () => {
    const policy = new RetryPolicy({ maxRetries: 2, minDelayMs: 1, maxDelayMs: 5 });
    const result = await policy.execute(async () => {
      throw AiLibError.fromHttpStatus(503, 'always fail');
    });
    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('always fail');
    expect(result.attempts).toBe(3);
  });

  it('should create config from protocol', () => {
    const config = retryConfigFromProtocol({
      max_retries: 5,
      min_delay_ms: 500,
      strategy: 'exponential_backoff',
      jitter: 'none',
    });
    expect(config.maxRetries).toBe(5);
    expect(config.minDelayMs).toBe(500);
    expect(config.jitter).toBe('none');
  });
});

describe('withRetry', () => {
  it('should return value on success', async () => {
    const result = await withRetry(async () => 'hello');
    expect(result).toBe('hello');
  });

  it('should throw on failure', async () => {
    await expect(
      withRetry(async () => {
        throw new Error('nope');
      }, { maxRetries: 1 })
    ).rejects.toThrow('nope');
  });
});

describe('CircuitBreaker', () => {
  it('should execute when closed', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2 });
    const result = await breaker.execute(async () => 1);
    expect(result).toBe(1);
  });

  it('should open after failures', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2, cooldownSeconds: 0.1 });
    await expect(breaker.execute(async () => { throw new Error('f1'); })).rejects.toThrow('f1');
    await expect(breaker.execute(async () => { throw new Error('f2'); })).rejects.toThrow('f2');
    await expect(breaker.execute(async () => 1)).rejects.toThrow(CircuitOpenError);
  });

  it('should use fallback when open', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1, cooldownSeconds: 10 });
    await expect(breaker.execute(async () => { throw new Error('f'); })).rejects.toThrow('f');
    const result = await breaker.execute(
      async () => { throw new Error('f'); },
      async () => 'fallback'
    );
    expect(result).toBe('fallback');
  });
});

describe('RateLimiter', () => {
  it('should allow when unlimited', async () => {
    const limiter = RateLimiter.unlimited();
    const wait = await limiter.acquire();
    expect(wait).toBe(0);
    expect(limiter.isLimited).toBe(false);
  });

  it('should acquire when tokens available', async () => {
    const limiter = RateLimiter.fromRps(10);
    const wait = await limiter.acquire();
    expect(wait).toBeLessThanOrEqual(0.2);
  });
});

describe('Backpressure', () => {
  it('should execute when unlimited', async () => {
    const bp = Backpressure.unlimited();
    const result = await bp.execute(async () => 1);
    expect(result).toBe(1);
  });

  it('should limit concurrency', async () => {
    const bp = new Backpressure({ maxConcurrent: 2 });
    const results: number[] = [];
    const promises = [
      bp.execute(async () => { results.push(1); return 1; }),
      bp.execute(async () => { results.push(2); return 2; }),
      bp.execute(async () => { results.push(3); return 3; }),
    ];
    await Promise.all(promises);
    expect(results).toHaveLength(3);
  });
});
