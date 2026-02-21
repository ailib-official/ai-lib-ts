/**
 * Tests for Negotiation module
 */

import { describe, it, expect } from 'vitest';
import {
  FallbackChain,
  firstSuccess,
  parallelAll,
  AiLibError,
} from '../src/index.ts';

describe('FallbackChain', () => {
  it('should succeed on first target', async () => {
    const chain = new FallbackChain<number>();
    chain.addTarget('a', async () => 1);
    chain.addTarget('b', async () => 2);
    const result = await chain.execute();
    expect(result.success).toBe(true);
    expect(result.value).toBe(1);
    expect(result.targetUsed).toBe('a');
  });

  it('should fallback on failure', async () => {
    const chain = new FallbackChain<number>();
    chain.addTarget('a', async () => { throw AiLibError.fromHttpStatus(503, 'fail'); });
    chain.addTarget('b', async () => 2);
    const result = await chain.execute();
    expect(result.success).toBe(true);
    expect(result.value).toBe(2);
    expect(result.targetUsed).toBe('b');
  });

  it('should not fallback on non-fallbackable error', async () => {
    const chain = new FallbackChain<number>();
    chain.addTarget('a', async () => { throw AiLibError.validation('invalid'); });
    chain.addTarget('b', async () => 2);
    const result = await chain.execute();
    expect(result.success).toBe(false);
    expect(result.targetsTried).toEqual(['a']);
  });

  it('should return empty when no targets', async () => {
    const chain = new FallbackChain<number>();
    const result = await chain.execute();
    expect(result.success).toBe(false);
    expect(result.errors._chain).toBeDefined();
  });
});

describe('firstSuccess', () => {
  it('should return first success', async () => {
    const result = await firstSuccess([
      { name: 'a', operation: async () => 1 },
      { name: 'b', operation: async () => 2 },
    ]);
    expect('value' in result).toBe(true);
    if ('value' in result) {
      expect(result.value).toBe(1);
      expect(result.targetUsed).toBe('a');
    }
  });

  it('should return error when all fail', async () => {
    const result = await firstSuccess([
      { name: 'a', operation: async () => { throw new Error('a'); } },
      { name: 'b', operation: async () => { throw new Error('b'); } },
    ]);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.results.size).toBe(2);
    }
  });
});

describe('parallelAll', () => {
  it('should aggregate all results', async () => {
    const result = await parallelAll([
      { name: 'a', operation: async () => 1 },
      { name: 'b', operation: async () => 2 },
    ]);
    expect(result.allSuccess).toBe(true);
    expect(result.anySuccess).toBe(true);
    expect(result.results.size).toBe(2);
    expect(result.value).toBe(1);
  });

  it('should report partial failure', async () => {
    const result = await parallelAll([
      { name: 'a', operation: async () => 1 },
      { name: 'b', operation: async () => { throw new Error('b'); } },
    ]);
    expect(result.anySuccess).toBe(true);
    expect(result.allSuccess).toBe(false);
    expect(result.results.get('a')?.success).toBe(true);
    expect(result.results.get('b')?.success).toBe(false);
  });
});
