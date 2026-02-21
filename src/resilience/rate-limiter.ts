/**
 * Rate limiter using token bucket algorithm.
 */

export interface RateLimiterConfig {
  requestsPerSecond?: number;
  burstSize?: number;
  initialTokens?: number;
}

export class RateLimiter {
  private readonly config: Required<RateLimiterConfig>;
  private tokens: number;
  private readonly maxTokens: number;
  private lastRefill: number;

  constructor(config: RateLimiterConfig = {}) {
    const burst = config.burstSize ?? 1;
    const initial = config.initialTokens ?? burst;
    this.config = {
      requestsPerSecond: config.requestsPerSecond ?? 0,
      burstSize: burst,
      initialTokens: initial,
    };
    this.tokens = initial;
    this.maxTokens = burst;
    this.lastRefill = performance.now() / 1000;
  }

  static fromRps(rps: number, burstMultiplier = 1.5): RateLimiter {
    const burst = rps > 0 ? Math.floor(rps * burstMultiplier) : 1;
    return new RateLimiter({
      requestsPerSecond: rps,
      burstSize: burst,
      initialTokens: burst,
    });
  }

  static fromRpm(rpm: number, burstMultiplier = 1.5): RateLimiter {
    return RateLimiter.fromRps(rpm / 60, burstMultiplier);
  }

  static unlimited(): RateLimiter {
    return new RateLimiter({ requestsPerSecond: 0 });
  }

  private refill(): void {
    if (this.config.requestsPerSecond <= 0) return;
    const now = performance.now() / 1000;
    const elapsed = now - this.lastRefill;
    this.lastRefill = now;
    const newTokens = elapsed * this.config.requestsPerSecond;
    this.tokens = Math.min(this.tokens + newTokens, this.maxTokens);
  }

  /**
   * Acquire tokens, waiting if necessary
   */
  async acquire(tokens = 1): Promise<number> {
    if (this.config.requestsPerSecond <= 0) return 0;

    this.refill();
    let waitTime = 0;

    if (this.tokens < tokens) {
      const deficit = tokens - this.tokens;
      waitTime = deficit / this.config.requestsPerSecond;
      await sleep(waitTime * 1000);
      this.refill();
    }

    this.tokens -= tokens;
    return waitTime;
  }

  /**
   * Try to acquire without waiting
   */
  tryAcquire(tokens = 1): boolean {
    if (this.config.requestsPerSecond <= 0) return true;
    this.refill();
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    return false;
  }

  getWaitTime(tokens = 1): number {
    if (this.config.requestsPerSecond <= 0) return 0;
    this.refill();
    if (this.tokens >= tokens) return 0;
    const deficit = tokens - this.tokens;
    return deficit / this.config.requestsPerSecond;
  }

  get availableTokens(): number {
    this.refill();
    return this.tokens;
  }

  get isLimited(): boolean {
    return this.config.requestsPerSecond > 0;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
