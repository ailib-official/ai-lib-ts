/**
 * P-layer transport barrel — E HTTP + resilience decorators.
 */

import type { ProtocolManifest, UnifiedRequest, UnifiedResponse } from '../protocol/manifest.js';
import { AiLibError } from '../errors/index.js';
import {
  RetryPolicy,
  retryConfigFromProtocol,
  CircuitBreaker,
  RateLimiter,
  Backpressure,
} from '../resilience/index.js';
import type {
  RetryConfig,
  CircuitBreakerConfig,
  RateLimiterConfig,
  BackpressureConfig,
} from '../resilience/index.js';
import {
  HttpTransport as BaseHttpTransport,
  createTransport as createBaseTransport,
} from './http.js';
import type {
  TransportOptions as BaseTransportOptions,
  TransportResponse,
} from './http.js';

export {
  MOCK_SERVER_URL,
  MOCK_SERVER_DEFAULT,
  isMockUrlAllowed,
  resolveMockBaseUrl,
} from './http.js';
export * from './credentials.js';
export type { CallStats, TransportResponse } from './http.js';

export interface ResilienceConfig {
  retryConfig?: RetryConfig;
  circuitBreaker?: CircuitBreakerConfig;
  rateLimiter?: RateLimiterConfig;
  backpressure?: BackpressureConfig;
}

export interface TransportOptions extends BaseTransportOptions {
  resilience?: ResilienceConfig;
}

/**
 * HTTP transport with optional P-layer resilience (retry, breaker, rate limit).
 */
export class HttpTransport extends BaseHttpTransport {
  private readonly retryPolicy: RetryPolicy;
  private readonly circuitBreaker?: CircuitBreaker;
  private readonly rateLimiter?: RateLimiter;
  private readonly backpressure?: Backpressure;

  constructor(manifest: ProtocolManifest, options: TransportOptions = {}) {
    super(manifest, options);

    const retryConfig =
      options.resilience?.retryConfig ??
      retryConfigFromProtocol(manifest.retry_policy);
    this.retryPolicy = new RetryPolicy(retryConfig);

    if (options.resilience?.circuitBreaker) {
      this.circuitBreaker = new CircuitBreaker(options.resilience.circuitBreaker);
    }
    if (options.resilience?.rateLimiter) {
      this.rateLimiter = new RateLimiter(options.resilience.rateLimiter);
    }
    if (options.resilience?.backpressure) {
      this.backpressure = new Backpressure(options.resilience.backpressure);
    }
  }

  override async execute(
    request: UnifiedRequest
  ): Promise<TransportResponse<UnifiedResponse>> {
    let op: () => Promise<TransportResponse<UnifiedResponse>> = () =>
      super.execute(request);

    if (this.rateLimiter?.isLimited) {
      const inner = op;
      op = async () => {
        await this.rateLimiter!.acquire();
        return inner();
      };
    }

    if (this.backpressure?.isLimited) {
      const inner = op;
      op = () => this.backpressure!.execute(inner);
    }

    if (this.circuitBreaker) {
      const inner = op;
      op = () => this.circuitBreaker!.execute(inner);
    }

    const result = await this.retryPolicy.execute(op);

    if (!result.success) {
      throw result.error ?? AiLibError.unknown('All retries exhausted');
    }

    const resp = result.value!;
    resp.stats.retryCount = result.attempts - 1;
    return resp;
  }
}

export function createTransport(
  manifest: ProtocolManifest,
  options?: TransportOptions
): HttpTransport {
  return new HttpTransport(manifest, options);
}

/** @internal E-only transport factory (contact/core paths). */
export { createBaseTransport };
