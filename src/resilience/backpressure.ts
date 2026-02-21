/**
 * Backpressure control using semaphore.
 * Limits concurrent operations to prevent overload.
 */

export interface BackpressureConfig {
  maxConcurrent?: number;
  queueTimeoutMs?: number | null;
}

export class BackpressureError extends Error {
  constructor(message = 'Backpressure limit exceeded') {
    super(message);
    this.name = 'BackpressureError';
  }
}

export class Backpressure {
  private readonly config: Required<BackpressureConfig>;
  private available: number;
  private currentInflight = 0;
  private peakInflight = 0;
  private totalAcquired = 0;
  private totalRejected = 0;
  private waitQueue: Array<() => void> = [];

  constructor(config: BackpressureConfig = {}) {
    const maxConcurrent = config.maxConcurrent ?? 10;
    this.config = {
      maxConcurrent,
      queueTimeoutMs: config.queueTimeoutMs ?? null,
    };
    this.available = maxConcurrent > 0 ? maxConcurrent : Number.POSITIVE_INFINITY;
  }

  static unlimited(): Backpressure {
    return new Backpressure({ maxConcurrent: 0 });
  }

  get currentInflightCount(): number {
    return this.currentInflight;
  }

  get availablePermits(): number {
    return this.available === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : Math.max(0, this.available);
  }

  get isLimited(): boolean {
    return this.available !== Number.POSITIVE_INFINITY;
  }

  /**
   * Acquire a permit for an operation
   */
  async acquire(): Promise<void> {
    if (this.available === Number.POSITIVE_INFINITY) {
      this.currentInflight++;
      this.peakInflight = Math.max(this.peakInflight, this.currentInflight);
      this.totalAcquired++;
      return;
    }

    if (this.available > 0) {
      this.available--;
      this.currentInflight++;
      this.peakInflight = Math.max(this.peakInflight, this.currentInflight);
      this.totalAcquired++;
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const timeout =
        this.config.queueTimeoutMs != null && this.config.queueTimeoutMs > 0
          ? setTimeout(() => {
              const idx = this.waitQueue.indexOf(doResolve);
              if (idx >= 0) this.waitQueue.splice(idx, 1);
              this.totalRejected++;
              reject(new BackpressureError('Timeout waiting for permit'));
            }, this.config.queueTimeoutMs)
          : null;

      const doResolve = (): void => {
        if (timeout) clearTimeout(timeout);
        this.available--;
        this.currentInflight++;
        this.peakInflight = Math.max(this.peakInflight, this.currentInflight);
        this.totalAcquired++;
        resolve();
      };

      this.waitQueue.push(doResolve);
      this.processQueue();
    });
  }

  private processQueue(): void {
    while (this.waitQueue.length > 0 && this.available > 0) {
      const next = this.waitQueue.shift();
      if (next) next();
    }
  }

  /**
   * Release a permit (must be called after acquire when done)
   */
  release(): void {
    this.currentInflight--;
    if (this.available !== Number.POSITIVE_INFINITY) {
      this.available++;
      this.processQueue();
    }
  }

  /**
   * Execute operation with backpressure control
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await operation();
    } finally {
      this.release();
    }
  }

  getStats(): {
    currentInflight: number;
    peakInflight: number;
    totalAcquired: number;
    totalRejected: number;
    maxConcurrent: number;
  } {
    return {
      currentInflight: this.currentInflight,
      peakInflight: this.peakInflight,
      totalAcquired: this.totalAcquired,
      totalRejected: this.totalRejected,
      maxConcurrent:
        this.config.maxConcurrent > 0
          ? this.config.maxConcurrent
          : Number.POSITIVE_INFINITY,
    };
  }
}
