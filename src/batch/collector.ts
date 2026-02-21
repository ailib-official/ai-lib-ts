/**
 * Batch collector for grouping requests.
 * Aligns with ai-lib-python batch/collector.py
 */

export interface BatchConfig {
  maxBatchSize?: number;
  maxWaitMs?: number;
  groupBy?: (data: unknown) => string;
}

export const defaultBatchConfig: Required<BatchConfig> = {
  maxBatchSize: 10,
  maxWaitMs: 100,
  groupBy: () => '_default_',
};

export function createBatchConfig(config?: BatchConfig): Required<BatchConfig> {
  return {
    ...defaultBatchConfig,
    ...config,
    groupBy: config?.groupBy ?? defaultBatchConfig.groupBy,
  };
}

export function batchConfigForEmbeddings(): Required<BatchConfig> {
  return {
    maxBatchSize: 100,
    maxWaitMs: 50,
    groupBy: () => '_default_',
  };
}

export function batchConfigForChat(): Required<BatchConfig> {
  return {
    maxBatchSize: 5,
    maxWaitMs: 10,
    groupBy: () => '_default_',
  };
}

interface PendingRequest<T, R> {
  data: T;
  resolve: (value: R) => void;
  reject: (reason: unknown) => void;
  addedAt: number;
  groupKey: string;
}

/**
 * Collects requests for batch processing.
 * Accumulates requests until batch size or time limit is reached,
 * then triggers batch execution.
 */
export class BatchCollector<T, R> {
  private readonly config: Required<BatchConfig>;
  private executor: ((items: T[]) => Promise<R[]>) | null = null;
  private pending: Map<string, PendingRequest<T, R>[]> = new Map();
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private running = true;

  constructor(
    config?: BatchConfig,
    executor?: (items: T[]) => Promise<R[]>
  ) {
    this.config = createBatchConfig(config);
    this.executor = executor ?? null;
  }

  setExecutor(executor: (items: T[]) => Promise<R[]>): void {
    this.executor = executor;
  }

  async add(data: T): Promise<R> {
    if (!this.running) {
      throw new Error('Batch collector is stopped');
    }
    if (!this.executor) {
      throw new Error('No executor set');
    }

    const groupKey = this.config.groupBy(data);
    const addedAt = performance.now();

    return new Promise<R>((resolve, reject) => {
      const req: PendingRequest<T, R> = {
        data,
        resolve,
        reject,
        addedAt,
        groupKey,
      };

      let list = this.pending.get(groupKey);
      if (!list) {
        list = [];
        this.pending.set(groupKey, list);
      }
      list.push(req);

      if (list.length >= this.config.maxBatchSize) {
        this.flushGroup(groupKey);
      } else {
        this.scheduleFlush(groupKey);
      }
    });
  }

  private scheduleFlush(groupKey: string): void {
    if (this.timers.has(groupKey)) return;
    const timer = setTimeout(() => {
      this.timers.delete(groupKey);
      this.flushGroup(groupKey);
    }, this.config.maxWaitMs);
    this.timers.set(groupKey, timer);
  }

  private async flushGroup(groupKey: string): Promise<void> {
    const list = this.pending.get(groupKey);
    if (!list || list.length === 0) return;

    this.pending.delete(groupKey);
    const timer = this.timers.get(groupKey);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(groupKey);
    }

    const dataList = list.map((r) => r.data);

    try {
      const results = await this.executor!(dataList);
      list.forEach((req, i) => {
        const result = results[i];
        if (result !== undefined) {
          req.resolve(result);
        } else {
          req.reject(new Error('Missing result in batch response'));
        }
      });
    } catch (e) {
      list.forEach((req) => req.reject(e));
    }
  }

  async flush(): Promise<void> {
    for (const groupKey of [...this.pending.keys()]) {
      await this.flushGroup(groupKey);
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    await this.flush();
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  getPendingCount(groupKey?: string): number {
    if (groupKey) {
      return this.pending.get(groupKey)?.length ?? 0;
    }
    return [...this.pending.values()].reduce((s, l) => s + l.length, 0);
  }

  get configSnapshot(): Required<BatchConfig> {
    return { ...this.config };
  }

  get isRunning(): boolean {
    return this.running;
  }
}
