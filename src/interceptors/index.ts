/**
 * Optional interceptor hooks for application-layer cross-cutting concerns.
 *
 * Runtime-first rationale:
 * - The runtime already provides protocol-driven retry/fallback/rate-limiting.
 * - Interceptors are still useful for logging, metrics, auditing, and custom business hooks.
 * - This module intentionally avoids depending on any provider SDK types.
 */

import type { Result } from '../errors/index.js';

/**
 * Minimal opaque request context passed to interceptors.
 *
 * Keeps interface stable to avoid API churn while hiding internal types.
 */
export interface RequestContext {
  provider: string;
  model: string;
  operation: string;
}

/**
 * Response context passed to interceptors.
 */
export interface ResponseContext {
  success: boolean;
}

/**
 * Unified request type (opaque, protocol-driven).
 */
export interface UnifiedRequest {
  [key: string]: unknown;
}

/**
 * Unified response type (opaque, protocol-driven).
 */
export interface UnifiedResponse {
  [key: string]: unknown;
}

/**
 * Error type compatible with Result.
 */
export interface AiLibError {
  code: string;
  message: string;
}

/**
 * Interceptor interface for cross-cutting concerns.
 *
 * Application-layer hooks for logging, metrics, auditing, and custom behavior.
 * Hooks are executed in order added to the pipeline.
 */
export interface Interceptor {
  /**
   * Before request sent.
   */
  onRequest?(ctx: RequestContext, req: UnifiedRequest): Promise<void> | void;

  /**
   * After successful response received.
   */
  onResponse?(ctx: RequestContext, req: UnifiedRequest, resp: UnifiedResponse): Promise<void> | void;

  /**
   * After error occurred.
   */
  onError?(ctx: RequestContext, req: UnifiedRequest, err: AiLibError): Promise<void> | void;
}

/**
 * Base interceptor class (empty implementations, override as needed).
 */
export abstract class BaseInterceptor implements Interceptor {
  async onRequest(_ctx: RequestContext, _req: UnifiedRequest): Promise<void> {
    // Override if needed
  }

  async onResponse(_ctx: RequestContext, _req: UnifiedRequest, _resp: UnifiedResponse): Promise<void> {
    // Override if needed
  }

  async onError(_ctx: RequestContext, _req: UnifiedRequest, _err: AiLibError): Promise<void> {
    // Override if needed
  }
}

/**
 * Interceptor pipeline that runs hooks in order.
 */
export class InterceptorPipeline {
  private interceptors: Interceptor[] = [];

  /**
   * Create a new empty pipeline.
   */
  static new(): InterceptorPipeline {
    return new InterceptorPipeline();
  }

  /**
   * Create a new empty pipeline (alias for static new).
   */
  constructor() {}

  /**
   * Add an interceptor to the pipeline.
   */
  with<TInterceptor extends Interceptor>(interceptor: TInterceptor): this {
    this.interceptors.push(interceptor);
    return this;
  }

  /**
   * Add an interceptor to the pipeline (alias for with).
   */
  add<TInterceptor extends Interceptor>(interceptor: TInterceptor): this {
    return this.with(interceptor);
  }

  /**
   * Clear all interceptors from the pipeline.
   */
  clear(): void {
    this.interceptors = [];
  }

  async onRequest(ctx: RequestContext, req: UnifiedRequest): Promise<void> {
    for (const ic of this.interceptors) {
      if (ic.onRequest) {
        await ic.onRequest(ctx, req);
      }
    }
  }

  async onResponse(ctx: RequestContext, req: UnifiedRequest, resp: UnifiedResponse): Promise<void> {
    for (const ic of this.interceptors) {
      if (ic.onResponse) {
        await ic.onResponse(ctx, req, resp);
      }
    }
  }

  async onError(ctx: RequestContext, _req: UnifiedRequest, _err: AiLibError): Promise<void> {
    for (const ic of this.interceptors) {
      if (ic.onError) {
        await ic.onError(ctx, req, err);
      }
    }
  }

  /**
   * Execute the pipeline around a request.
   *
   * @param ctx - Request context
   * @param req - Unified request
   * @param fn - Async function to execute the actual call
   * @returns Result of the function
   */
  async execute<TResponse = UnifiedResponse>(
    ctx: RequestContext,
    req: UnifiedRequest,
    fn: () => Promise<Result<TResponse>>,
  ): Promise<Result<TResponse>> {
    await this.onRequest(ctx, req);

    const result = await fn();

    if (result.ok) {
      if (typeof result.value === 'object' && result.value !== null && 'success' in result.value) {
        await this.onResponse(ctx, req, result.value as UnifiedResponse);
      } else {
        await this.onResponse(ctx, req, result.value as unknown as UnifiedResponse);
      }
    } else {
      await this.onError(ctx, req, result.error as unknown as AiLibError);
    }

    return result;
  }

  /**
   * Execute the pipeline around a request (alias for execute).
   */
  async run<TResponse = UnifiedResponse>(
    ctx: RequestContext,
    req: UnifiedRequest,
    fn: () => Promise<Result<TResponse>>,
  ): Promise<Result<TResponse>> {
    return this.execute(ctx, req, fn);
  }
}

/**
 * Create a new InterceptorPipeline (factory function).
 */
export function createInterceptorPipeline(): InterceptorPipeline {
  return InterceptorPipeline.new();
}

// Helper interceptors

/**
 * Logging interceptor - logs request/response/error events.
 */
export class LoggingInterceptor extends BaseInterceptor {
  private readonly prefix: string;
  private readonly logFn: (message: string) => void;

  constructor(options?: { prefix?: string; logFn?: (message: string) => void }) {
    super();
    this.prefix = options?.prefix ?? '[Interceptor]';
    this.logFn = options?.logFn ?? console.log;
  }

  async onRequest(ctx: RequestContext, _req: UnifiedRequest): Promise<void> {
    this.logFn(`${this.prefix} Request: ${ctx.provider}/${ctx.model} ${ctx.operation}`);
  }

  async onResponse(ctx: RequestContext, _req: UnifiedRequest, _resp: UnifiedResponse): Promise<void> {
    this.logFn(`${this.prefix} Response: ${ctx.provider}/${ctx.model} Success`);
  }

  async onError(ctx: RequestContext, _req: UnifiedRequest, err: AiLibError): Promise<void> {
    this.logFn(`${this.prefix} Error: ${ctx.provider}/${ctx.model} ${err.code}: ${err.message}`);
  }
}

/**
 * Metrics interceptor - counts requests/responses/errors.
 */
export class MetricsInterceptor extends BaseInterceptor {
  private metrics: Map<string, { requests: number; successes: number; errors: number }>;

  constructor() {
    super();
    this.metrics = new Map();
  }

  private getMetricsKey(ctx: RequestContext): string {
    return `${ctx.provider}/${ctx.model}`;
  }

  async onRequest(ctx: RequestContext, _req: UnifiedRequest): Promise<void> {
    const key = this.getMetricsKey(ctx);
    const current = this.metrics.get(key) ?? { requests: 0, successes: 0, errors: 0 };
    current.requests++;
    this.metrics.set(key, current);
  }

  async onResponse(ctx: RequestContext, _req: UnifiedRequest, _resp: UnifiedResponse): Promise<void> {
    const key = this.getMetricsKey(ctx);
    const current = this.metrics.get(key) ?? { requests: 0, successes: 0, errors: 0 };
    current.successes++;
    this.metrics.set(key, current);
  }

  async onError(ctx: RequestContext, _req: UnifiedRequest, _err: AiLibError): Promise<void> {
    const key = this.getMetricsKey(ctx);
    const current = this.metrics.get(key) ?? { requests: 0, successes: 0, errors: 0 };
    current.errors++;
    this.metrics.set(key, current);
  }

  /**
   * Get all collected metrics.
   */
  getMetrics(): Map<string, { requests: number; successes: number; errors: number }> {
    return new Map(this.metrics);
  }

  /**
   * Get metrics for a specific provider/model.
   */
  getMetricsFor(provider: string, model: string): { requests: number; successes: number; errors: number } | undefined {
    return this.metrics.get(`${provider}/${model}`);
  }

  /**
   * Reset all metrics.
   */
  reset(): void {
    this.metrics.clear();
  }
}

/**
 * Timing interceptor - measures request duration.
 */
export class TimingInterceptor extends BaseInterceptor {
  private timings: Map<string, number[]>;
  private startTime: Map<string, number>;

  constructor() {
    super();
    this.timings = new Map();
    this.startTime = new Map();
  }

  private getTimingKey(ctx: RequestContext): string {
    return `${ctx.provider}/${ctx.model}`;
  }

  async onRequest(ctx: RequestContext, _req: UnifiedRequest): Promise<void> {
    const key = this.getTimingKey(ctx);
    this.startTime.set(key, Date.now());
  }

  async onResponse(ctx: RequestContext, _req: UnifiedRequest, _resp: UnifiedResponse): Promise<void> {
    const key = this.getTimingKey(ctx);
    const start = this.startTime.get(key);
    if (start !== undefined) {
      const duration = Date.now() - start;
      const timings = this.timings.get(key) ?? [];
      timings.push(duration);
      this.timings.set(key, timings);
    }
    this.startTime.delete(key);
  }

  async onError(ctx: RequestContext, req: UnifiedRequest, err: AiLibError): Promise<void> {
    const key = this.getTimingKey(ctx);
    this.startTime.delete(key);
  }

  /**
   * Get all timing measurements.
   */
  getTimings(): Map<string, number[]> {
    return new Map(this.timings);
  }

  /**
   * Get timings for a specific provider/model.
   */
  getTimingsFor(provider: string, model: string): number[] | undefined {
    return this.timings.get(`${provider}/${model}`);
  }

  /**
   * Get average timing for a specific provider/model.
   */
  getAverageTiming(provider: string, model: string): number | undefined {
    const timings = this.getTimingsFor(provider, model);
    if (timings === undefined || timings.length === 0) {
      return undefined;
    }
    const sum = timings.reduce((acc, t) => acc + t, 0);
    return sum / timings.length;
  }

  /**
   * Reset all timings.
   */
  reset(): void {
    this.timings.clear();
    this.startTime.clear();
  }
}
