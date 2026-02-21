/**
 * In-memory cache for AI responses.
 * Simple TTL-based cache.
 */

export interface MemoryCacheOptions {
  ttlMs?: number;
  maxSize?: number;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * In-memory cache with TTL and optional size limit
 */
export class MemoryCache<K = string, V = unknown> {
  private readonly ttlMs: number;
  private readonly maxSize: number;
  private readonly store = new Map<K, CacheEntry<V>>();
  private readonly accessOrder: K[] = [];

  constructor(options: MemoryCacheOptions = {}) {
    this.ttlMs = options.ttlMs ?? 60_000; // 1 min default
    this.maxSize = options.maxSize ?? 1000;
  }

  get(key: K): V | undefined {
    this.evictExpired();
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    this.touch(key);
    return entry.value;
  }

  set(key: K, value: V, ttlMs?: number): void {
    this.evictExpired();
    const ttl = ttlMs ?? this.ttlMs;
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
    this.touch(key);
    if (this.store.size > this.maxSize) {
      this.evictLRU();
    }
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): boolean {
    const idx = this.accessOrder.indexOf(key);
    if (idx >= 0) this.accessOrder.splice(idx, 1);
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
    this.accessOrder.length = 0;
  }

  get size(): number {
    this.evictExpired();
    return this.store.size;
  }

  private touch(key: K): void {
    const idx = this.accessOrder.indexOf(key);
    if (idx >= 0) this.accessOrder.splice(idx, 1);
    this.accessOrder.push(key);
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [k, v] of this.store) {
      if (v.expiresAt <= now) {
        this.store.delete(k);
        const idx = this.accessOrder.indexOf(k);
        if (idx >= 0) this.accessOrder.splice(idx, 1);
      }
    }
  }

  private evictLRU(): void {
    while (this.store.size > this.maxSize && this.accessOrder.length > 0) {
      const key = this.accessOrder.shift();
      if (key != null) this.store.delete(key);
    }
  }
}
