/**
 * Tests for Extras (Embeddings, Cache, Structured, Tokens)
 */

import { describe, it, expect } from 'vitest';
import {
  EmbeddingClientBuilder,
  MemoryCache,
  jsonObjectConfig,
  jsonSchemaConfig,
  toOpenAIResponseFormat,
  estimateTokens,
  estimateCost,
} from '../src/index.ts';

describe('EmbeddingClientBuilder', () => {
  it('should require model', () => {
    expect(() => new EmbeddingClientBuilder().build()).toThrow('Model must be specified');
  });
});

describe('MemoryCache', () => {
  it('should get and set', () => {
    const cache = new MemoryCache<string, number>({ ttlMs: 1000 });
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
  });

  it('should return undefined for missing key', () => {
    const cache = new MemoryCache<string, number>();
    expect(cache.get('missing')).toBeUndefined();
  });

  it('should delete', () => {
    const cache = new MemoryCache<string, number>();
    cache.set('a', 1);
    expect(cache.delete('a')).toBe(true);
    expect(cache.get('a')).toBeUndefined();
  });
});

describe('Structured output', () => {
  it('should create json object config', () => {
    const config = jsonObjectConfig();
    expect(config.mode).toBe('json');
  });

  it('should create json schema config', () => {
    const config = jsonSchemaConfig({ type: 'object', properties: {} });
    expect(config.mode).toBe('json_schema');
    expect(config.schema?.type).toBe('object');
  });

  it('should build OpenAI response_format', () => {
    expect(toOpenAIResponseFormat({ mode: 'json' })).toEqual({ type: 'json_object' });
    expect(toOpenAIResponseFormat({ mode: 'off' })).toBeUndefined();
  });
});

describe('Token estimator', () => {
  it('should estimate tokens', () => {
    expect(estimateTokens('hello')).toBe(2);
    expect(estimateTokens('')).toBe(0);
  });

  it('should estimate cost', () => {
    const cost = estimateCost(1000, 500, 1, 2);
    expect(cost).toBe(0.001 + 0.001);
  });
});
