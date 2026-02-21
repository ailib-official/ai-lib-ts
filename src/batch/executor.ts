/**
 * Batch executor for parallel request execution.
 * Aligns with ai-lib-python batch/executor.py
 */

export interface BatchResult<R> {
  results: (R | null)[];
  errors: (Error | null)[];
  totalTimeMs: number;
  successfulCount: number;
  failedCount: number;
  allSuccessful: boolean;
}

export interface BatchExecutorOptions {
  maxConcurrent?: number;
  failFast?: boolean;
}

/**
 * Executes batches of requests concurrently.
 */
export class BatchExecutor<T, R> {
  private readonly operation: (item: T) => Promise<R>;
  private readonly maxConcurrent: number;
  private readonly failFast: boolean;
  private available = 0;
  private waitQueue: Array<() => void> = [];

  constructor(
    operation: (item: T) => Promise<R>,
    options: BatchExecutorOptions = {}
  ) {
    this.operation = operation;
    this.maxConcurrent = options.maxConcurrent ?? 10;
    this.failFast = options.failFast ?? false;
    this.available = this.maxConcurrent;
  }

  private async acquire(): Promise<void> {
    if (this.available > 0) {
      this.available--;
      return;
    }
    return new Promise<void>((resolve) => {
      this.waitQueue.push(() => {
        this.available--;
        resolve();
      });
    });
  }

  private release(): void {
    this.available++;
    const next = this.waitQueue.shift();
    if (next) next();
  }

  async execute(items: readonly T[]): Promise<BatchResult<R>> {
    const start = performance.now();
    const results: (R | null)[] = new Array(items.length).fill(null);
    const errors: (Error | null)[] = new Array(items.length).fill(null);

    const runOne = async (item: T, index: number): Promise<void> => {
      await this.acquire();
      try {
        results[index] = await this.operation(item);
      } catch (e) {
        errors[index] = e instanceof Error ? e : new Error(String(e));
        if (this.failFast) throw e;
      } finally {
        this.release();
      }
    };

    const tasks = items.map((item, idx) => runOne(item, idx));
    if (this.failFast) {
      try {
        await Promise.all(tasks);
      } catch {
        await Promise.allSettled(tasks);
      }
    } else {
      await Promise.all(tasks);
    }

    const successfulCount = errors.filter((e) => e === null).length;
    const failedCount = errors.filter((e) => e !== null).length;
    return {
      results,
      errors,
      totalTimeMs: performance.now() - start,
      successfulCount,
      failedCount,
      allSuccessful: failedCount === 0,
    };
  }

  async executeWithProgress(
    items: readonly T[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<BatchResult<R>> {
    const start = performance.now();
    const results: (R | null)[] = new Array(items.length).fill(null);
    const errors: (Error | null)[] = new Array(items.length).fill(null);
    let completed = 0;
    const total = items.length;

    const runOne = async (item: T, index: number): Promise<void> => {
      await this.acquire();
      try {
        results[index] = await this.operation(item);
      } catch (e) {
        errors[index] = e instanceof Error ? e : new Error(String(e));
      } finally {
        this.release();
        completed++;
        onProgress?.(completed, total);
      }
    };

    await Promise.all(items.map((item, idx) => runOne(item, idx)));

    const successfulCount = errors.filter((e) => e === null).length;
    const failedCount = errors.filter((e) => e !== null).length;
    return {
      results,
      errors,
      totalTimeMs: performance.now() - start,
      successfulCount,
      failedCount,
      allSuccessful: failedCount === 0,
    };
  }

  get maxConcurrentCount(): number {
    return this.maxConcurrent;
  }
}

export async function batchExecute<T, R>(
  items: readonly T[],
  operation: (item: T) => Promise<R>,
  options: BatchExecutorOptions = {}
): Promise<BatchResult<R>> {
  const executor = new BatchExecutor(operation, options);
  return executor.execute(items);
}
