/**
 * Hook manager for event-driven extensibility.
 */

import type { HookType } from './types.js';

interface HookEntry {
  hookType: HookType;
  callback: (...args: unknown[]) => Promise<unknown>;
  priority: number;
  name: string;
}

export class HookManager {
  private readonly hooks = new Map<HookType, HookEntry[]>();

  register(
    hookType: HookType,
    callback: (...args: unknown[]) => Promise<unknown>,
    options?: { priority?: number; name?: string }
  ): HookEntry {
    const entry: HookEntry = {
      hookType,
      callback,
      priority: options?.priority ?? 50,
      name: options?.name ?? (callback.name || ''),
    };
    const list = this.hooks.get(hookType) ?? [];
    list.push(entry);
    list.sort((a, b) => a.priority - b.priority);
    this.hooks.set(hookType, list);
    return entry;
  }

  unregister(hookType: HookType, entry: HookEntry): boolean {
    const list = this.hooks.get(hookType);
    if (!list) return false;
    const idx = list.indexOf(entry);
    if (idx >= 0) {
      list.splice(idx, 1);
      return true;
    }
    return false;
  }

  async execute<T>(hookType: HookType, value: T, ...args: unknown[]): Promise<T> {
    const list = this.hooks.get(hookType) ?? [];
    let result: unknown = value;
    for (const hook of list) {
      try {
        result = await hook.callback(result, ...args);
      } catch {
        // Continue on hook error
      }
    }
    return result as T;
  }
}
