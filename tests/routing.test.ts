/**
 * Tests for Routing module
 */

import { describe, it, expect } from 'vitest';
import {
  ModelManager,
  ModelArray,
  CostBasedSelector,
  QualityBasedSelector,
  RoundRobinSelector,
  modelSupports,
  createModelSelector,
} from '../src/routing/index.ts';
import type { ModelInfo, ModelEndpoint } from '../src/routing/index.ts';

const createTestModel = (overrides: Partial<ModelInfo> = {}): ModelInfo => ({
  name: 'test',
  provider: 'test-provider',
  capabilities: { chat: true, streaming: true },
  pricing: { inputCostPer1k: 1, outputCostPer1k: 2 },
  performance: { speed: 'balanced', quality: 'good' },
  ...overrides,
});

describe('modelSupports', () => {
  it('should support chat by default', () => {
    expect(modelSupports(createTestModel(), 'chat')).toBe(true);
  });
  it('should support vision when multimodal', () => {
    expect(
      modelSupports(createTestModel({ capabilities: { multimodal: true } }), 'vision')
    ).toBe(true);
  });
  it('should not support unknown capability', () => {
    expect(modelSupports(createTestModel(), 'unknown')).toBe(false);
  });
});

describe('ModelManager', () => {
  it('should add and list models', () => {
    const manager = new ModelManager({ provider: 'openai' });
    manager.addModel(createTestModel({ name: 'gpt-4o' }));
    manager.addModel(createTestModel({ name: 'gpt-4o-mini' }));
    expect(manager.listModels()).toHaveLength(2);
    expect(manager.has('gpt-4o')).toBe(true);
  });

  it('should select model with round-robin', () => {
    const manager = new ModelManager({ strategy: 'round_robin' });
    manager.addModel(createTestModel({ name: 'a' }));
    manager.addModel(createTestModel({ name: 'b' }));
    const first = manager.selectModel();
    const second = manager.selectModel();
    expect(first?.name).toBe('a');
    expect(second?.name).toBe('b');
  });

  it('should select cheapest with cost_based', () => {
    const manager = new ModelManager({ strategy: 'cost_based' });
    manager.addModel(createTestModel({ name: 'expensive', pricing: { inputCostPer1k: 10, outputCostPer1k: 20 } }));
    manager.addModel(createTestModel({ name: 'cheap', pricing: { inputCostPer1k: 0.1, outputCostPer1k: 0.2 } }));
    const selected = manager.selectModel();
    expect(selected?.name).toBe('cheap');
  });

  it('should select highest quality with quality_based', () => {
    const manager = new ModelManager({ strategy: 'quality_based' });
    manager.addModel(createTestModel({ name: 'basic', performance: { quality: 'basic' } }));
    manager.addModel(createTestModel({ name: 'excellent', performance: { quality: 'excellent' } }));
    const selected = manager.selectModel();
    expect(selected?.name).toBe('excellent');
  });

  it('should recommend for capability', () => {
    const manager = new ModelManager();
    manager.addModel(createTestModel({ name: 'no-vision', capabilities: { multimodal: false } }));
    manager.addModel(createTestModel({ name: 'with-vision', capabilities: { multimodal: true } }));
    const rec = manager.recommendFor('vision');
    expect(rec?.name).toBe('with-vision');
  });

  it('should filter by capability', () => {
    const manager = new ModelManager();
    manager.addModel(createTestModel({ name: 'a', capabilities: { toolUse: true } }));
    manager.addModel(createTestModel({ name: 'b', capabilities: {} }));
    const filtered = manager.filterByCapability('tools');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('a');
  });
});

describe('ModelArray', () => {
  it('should add and select endpoint', () => {
    const array = new ModelArray('cluster');
    array.addEndpoint({ name: 'primary', modelName: 'gpt-4o', url: 'https://api1.example.com' });
    array.addEndpoint({ name: 'secondary', modelName: 'gpt-4o', url: 'https://api2.example.com' });
    const ep = array.selectEndpoint();
    expect(ep).not.toBeNull();
    expect(['primary', 'secondary']).toContain(ep!.name);
  });

  it('should exclude unhealthy endpoints', () => {
    const array = new ModelArray('cluster');
    array.addEndpoint({ name: 'bad', modelName: 'gpt-4o', url: 'https://bad.example.com', healthy: false });
    array.addEndpoint({ name: 'good', modelName: 'gpt-4o', url: 'https://good.example.com', healthy: true });
    const ep = array.selectEndpoint();
    expect(ep?.name).toBe('good');
  });

  it('should mark unhealthy', () => {
    const array = new ModelArray('cluster');
    array.addEndpoint({ name: 'ep1', modelName: 'gpt-4o', url: 'https://api.example.com' });
    expect(array.markUnhealthy('ep1')).toBe(true);
    expect(array.getEndpoint('ep1')?.healthy).toBe(false);
  });
});

describe('Selectors', () => {
  it('CostBasedSelector selects cheapest', () => {
    const selector = new CostBasedSelector();
    const models = [
      createTestModel({ name: 'a', pricing: { inputCostPer1k: 5, outputCostPer1k: 5 } }),
      createTestModel({ name: 'b', pricing: { inputCostPer1k: 1, outputCostPer1k: 1 } }),
    ];
    expect(selector.select(models)?.name).toBe('b');
  });

  it('QualityBasedSelector selects best', () => {
    const selector = new QualityBasedSelector();
    const models = [
      createTestModel({ name: 'a', performance: { quality: 'basic' } }),
      createTestModel({ name: 'b', performance: { quality: 'excellent' } }),
    ];
    expect(selector.select(models)?.name).toBe('b');
  });
});
