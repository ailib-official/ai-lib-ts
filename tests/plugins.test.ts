/**
 * Tests for Plugins module
 */

import { describe, it, expect } from 'vitest';
import { PluginRegistry, HookManager } from '../src/index.ts';
import type { Plugin, PluginContext } from '../src/index.ts';

const createTestPlugin = (name: string, priority?: number): Plugin => ({
  name,
  priority,
  onRequest: async (_ctx, req) => ({ ...req, [name]: true }),
});

describe('PluginRegistry', () => {
  it('should register and list plugins', () => {
    const registry = new PluginRegistry();
    registry.register(createTestPlugin('a'));
    registry.register(createTestPlugin('b'));
    expect(registry.list()).toHaveLength(2);
    expect(registry.has('a')).toBe(true);
  });

  it('should reject duplicate registration', () => {
    const registry = new PluginRegistry();
    registry.register(createTestPlugin('a'));
    expect(() => registry.register(createTestPlugin('a'))).toThrow('already registered');
  });

  it('should process request through plugins', async () => {
    const registry = new PluginRegistry();
    registry.register(createTestPlugin('first', 10));
    registry.register(createTestPlugin('second', 20));
    const result = await registry.processRequest({}, { msg: 'hi' });
    expect(result.first).toBe(true);
    expect(result.second).toBe(true);
  });

  it('should unregister', () => {
    const registry = new PluginRegistry();
    registry.register(createTestPlugin('a'));
    expect(registry.unregister('a')).toBe(true);
    expect(registry.has('a')).toBe(false);
  });
});

describe('HookManager', () => {
  it('should execute hooks', async () => {
    const manager = new HookManager();
    manager.register('pre_request', async (req) => {
      const r = req as Record<string, unknown>;
      return { ...r, x: 1 };
    });
    manager.register('pre_request', async (req) => {
      const r = req as Record<string, unknown>;
      return { ...r, y: 2 };
    });
    const result = await manager.execute('pre_request', { a: 1 });
    expect(result).toMatchObject({ a: 1, x: 1, y: 2 });
  });

  it('should execute in priority order', async () => {
    const manager = new HookManager();
    const order: number[] = [];
    manager.register('pre_request', async (v) => { order.push(2); return v; }, { priority: 20 });
    manager.register('pre_request', async (v) => { order.push(1); return v; }, { priority: 10 });
    await manager.execute('pre_request', 0);
    expect(order).toEqual([1, 2]);
  });
});
