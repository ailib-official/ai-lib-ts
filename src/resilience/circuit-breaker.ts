/**
 * Circuit breaker for fault isolation.
 * States: Closed (normal) -> Open (fail fast) -> Half-Open (testing)
 */

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerConfig {
  failureThreshold?: number;
  successThreshold?: number;
  cooldownSeconds?: number;
  timeoutSeconds?: number;
  halfOpenMaxConcurrent?: number;
}

export class CircuitOpenError extends Error {
  readonly timeUntilRetry?: number;

  constructor(message = 'Circuit breaker is open', timeUntilRetry?: number) {
    super(message);
    this.name = 'CircuitOpenError';
    this.timeUntilRetry = timeUntilRetry;
  }
}

export interface CircuitStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rejectedRequests: number;
  stateChanges: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
}

interface CircuitBreakerConfigResolved {
  failureThreshold: number;
  successThreshold: number;
  cooldownSeconds: number;
  timeoutSeconds?: number;
  halfOpenMaxConcurrent: number;
}

export class CircuitBreaker {
  private readonly config: CircuitBreakerConfigResolved;
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private openedAt: number | null = null;
  private halfOpenConcurrent = 0;
  private readonly stats: CircuitStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    rejectedRequests: 0,
    stateChanges: 0,
  };
  private mutex = Promise.resolve();

  constructor(config: CircuitBreakerConfig = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      successThreshold: config.successThreshold ?? 2,
      cooldownSeconds: config.cooldownSeconds ?? 30,
      timeoutSeconds: config.timeoutSeconds,
      halfOpenMaxConcurrent: config.halfOpenMaxConcurrent ?? 1,
    } as CircuitBreakerConfigResolved;
  }

  getState(): CircuitState {
    this.checkStateTransition();
    return this.state;
  }

  get isClosed(): boolean {
    return this.getState() === 'closed';
  }

  get isOpen(): boolean {
    return this.getState() === 'open';
  }

  get isHalfOpen(): boolean {
    return this.getState() === 'half_open';
  }

  private checkStateTransition(): void {
    const now = performance.now() / 1000;
    if (this.state === 'open' && this.openedAt != null) {
      const elapsed = now - this.openedAt;
      if (elapsed >= this.config.cooldownSeconds) {
        this.transitionTo('half_open');
      }
    }
  }

  private transitionTo(newState: CircuitState): void {
    if (newState === this.state) return;
    this.state = newState;
    this.stats.stateChanges++;
    if (newState === 'open') {
      this.openedAt = performance.now() / 1000;
    } else if (newState === 'half_open') {
      this.successCount = 0;
    } else if (newState === 'closed') {
      this.failureCount = 0;
      this.openedAt = null;
    }
  }

  private recordSuccess(): void {
    const now = performance.now() / 1000;
    this.stats.successfulRequests++;
    this.stats.lastSuccessTime = now;
    if (this.state === 'half_open') {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.transitionTo('closed');
      }
    } else if (this.state === 'closed') {
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  private recordFailure(): void {
    const now = performance.now() / 1000;
    this.stats.failedRequests++;
    this.stats.lastFailureTime = now;
    if (this.state === 'half_open') {
      this.transitionTo('open');
    } else if (this.state === 'closed') {
      this.failureCount++;
      if (this.failureCount >= this.config.failureThreshold) {
        this.transitionTo('open');
      }
    }
  }

  /** Report success (for use with PreflightChecker) */
  reportSuccess(): void {
    this.recordSuccess();
  }

  /** Report failure (for use with PreflightChecker) */
  reportFailure(): void {
    this.recordFailure();
  }

  getTimeUntilRetry(): number | undefined {
    this.checkStateTransition();
    if (this.state !== 'open' || this.openedAt == null) return undefined;
    const elapsed = performance.now() / 1000 - this.openedAt;
    const remaining = this.config.cooldownSeconds - elapsed;
    return Math.max(0, remaining);
  }

  /**
   * Execute operation through circuit breaker
   */
  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    const runWithMutex = async (): Promise<T> => {
      this.checkStateTransition();
      this.stats.totalRequests++;

      if (this.state === 'open') {
        this.stats.rejectedRequests++;
        if (fallback) return fallback();
        throw new CircuitOpenError(
          'Circuit breaker is open',
          this.getTimeUntilRetry()
        );
      }

      const runOp = (): Promise<T> => {
        if (this.config.timeoutSeconds != null && this.config.timeoutSeconds > 0) {
          return Promise.race([
            operation(),
            new Promise<T>((_, reject) =>
              setTimeout(
                () => reject(new Error('Circuit breaker timeout')),
                this.config.timeoutSeconds! * 1000
              )
            ),
          ]);
        }
        return operation();
      };

      if (this.state === 'half_open') {
        if (this.halfOpenConcurrent >= this.config.halfOpenMaxConcurrent) {
          if (fallback) return fallback();
          throw new CircuitOpenError('Half-open limit reached');
        }
        this.halfOpenConcurrent++;
      }

      try {
        const result = await runOp();
        this.recordSuccess();
        return result;
      } catch (e) {
        this.recordFailure();
        throw e;
      } finally {
        if (this.state === 'half_open') {
          this.halfOpenConcurrent--;
        }
      }
    };

    const prev = this.mutex;
    let resolveMutex: () => void = () => {};
    this.mutex = new Promise<void>((r) => {
      resolveMutex = r;
    });
    try {
      await prev;
      return await runWithMutex();
    } finally {
      resolveMutex();
    }
  }

  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.openedAt = null;
  }

  getStats(): CircuitStats {
    return { ...this.stats };
  }
}
