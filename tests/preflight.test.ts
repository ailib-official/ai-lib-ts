import { describe, it, expect } from 'vitest';
import {
  PreflightChecker,
  PreflightError,
  CircuitBreaker,
  Backpressure,
} from '../src/index.js';

describe('PreflightChecker', () => {
  it('passes when no components configured', async () => {
    const checker = new PreflightChecker({});
    const result = await checker.check();
    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
    result.release();
  });

  it('fails when circuit breaker is open', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, cooldownSeconds: 60 });
    try {
      await cb.execute(() => Promise.reject(new Error('fail')));
    } catch {
      /* expected */
    }

    const checker = new PreflightChecker({ circuitBreaker: cb });
    const result = await checker.check();
    expect(result.passed).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toBeInstanceOf(PreflightError);
    expect(result.errors[0]?.component).toBe('circuit_breaker');
    result.release();
  });

  it('passes when circuit breaker is closed', async () => {
    const cb = new CircuitBreaker();
    const checker = new PreflightChecker({ circuitBreaker: cb });
    const result = await checker.check();
    expect(result.passed).toBe(true);
    result.release();
  });

  it('acquires and releases backpressure permit', async () => {
    const bp = new Backpressure({ maxConcurrent: 2 });
    const checker = new PreflightChecker({ backpressure: bp });

    const r1 = await checker.check();
    expect(r1.passed).toBe(true);
    expect(bp.currentInflightCount).toBe(1);

    const r2 = await checker.check();
    expect(r2.passed).toBe(true);
    expect(bp.currentInflightCount).toBe(2);

    r1.release();
    expect(bp.currentInflightCount).toBe(1);
    r2.release();
    expect(bp.currentInflightCount).toBe(0);
  });
});
