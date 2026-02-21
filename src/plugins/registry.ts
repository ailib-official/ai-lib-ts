/**
 * Plugin registry for managing plugins.
 */

import type { Plugin, PluginContext } from './types.js';

export class PluginRegistry {
  private readonly plugins = new Map<string, Plugin>();
  private ordered: Plugin[] = [];

  register(plugin: Plugin): this {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin already registered: ${plugin.name}`);
    }
    this.plugins.set(plugin.name, plugin);
    this.updateOrder();
    return this;
  }

  unregister(name: string): boolean {
    if (this.plugins.delete(name)) {
      this.updateOrder();
      return true;
    }
    return false;
  }

  get(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  has(name: string): boolean {
    return this.plugins.has(name);
  }

  list(): Plugin[] {
    return [...this.ordered];
  }

  async initAll(ctx: PluginContext): Promise<void> {
    for (const plugin of this.ordered) {
      if (plugin.enabled !== false && plugin.onInit) {
        await plugin.onInit(ctx);
      }
    }
  }

  async shutdownAll(ctx: PluginContext): Promise<void> {
    for (const plugin of [...this.ordered].reverse()) {
      if (plugin.enabled !== false && plugin.onShutdown) {
        await plugin.onShutdown(ctx);
      }
    }
  }

  async processRequest(ctx: PluginContext, request: Record<string, unknown>): Promise<Record<string, unknown>> {
    let req = request;
    for (const plugin of this.ordered) {
      if (plugin.enabled !== false && plugin.onRequest) {
        req = await plugin.onRequest(ctx, req);
      }
    }
    return req;
  }

  async processResponse(ctx: PluginContext, response: Record<string, unknown>): Promise<Record<string, unknown>> {
    let resp = response;
    for (const plugin of [...this.ordered].reverse()) {
      if (plugin.enabled !== false && plugin.onResponse) {
        resp = await plugin.onResponse(ctx, resp);
      }
    }
    return resp;
  }

  private updateOrder(): void {
    this.ordered = [...this.plugins.values()].sort(
      (a, b) => (a.priority ?? 50) - (b.priority ?? 50)
    );
  }
}
