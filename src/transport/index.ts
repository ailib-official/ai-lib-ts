/**
 * HTTP Transport layer for AI-Protocol TypeScript Runtime
 *
 * Uses native fetch API for HTTP requests with streaming support.
 */

import type { ProtocolManifest, UnifiedRequest, UnifiedResponse } from '../protocol/manifest.js';
import { AiLibError } from '../errors/index.js';
import type { StreamingEvent } from '../types/index.js';
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

/**
 * Mock server URL for testing (priority: 192.168.2.13)
 */
export const MOCK_SERVER_URL = process.env.MOCK_HTTP_URL ?? 'http://192.168.2.13:4010';

/**
 * Resilience configuration for transport
 */
export interface ResilienceConfig {
  retryConfig?: RetryConfig;
  circuitBreaker?: CircuitBreakerConfig;
  rateLimiter?: RateLimiterConfig;
  backpressure?: BackpressureConfig;
}

/**
 * Transport options
 */
export interface TransportOptions {
  baseUrlOverride?: string;
  timeout?: number;
  headers?: Record<string, string>;
  proxyUrl?: string;
  resilience?: ResilienceConfig;
}

/**
 * Call statistics
 */
export interface CallStats {
  latencyMs: number;
  retryCount: number;
  requestId?: string;
  endpoint: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

/**
 * Transport response with stats
 */
export interface TransportResponse<T> {
  data: T;
  stats: CallStats;
}

/**
 * HTTP Transport class
 */
export class HttpTransport {
  private readonly manifest: ProtocolManifest;
  private readonly options: TransportOptions;
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly retryPolicy: RetryPolicy;
  private readonly circuitBreaker?: CircuitBreaker;
  private readonly rateLimiter?: RateLimiter;
  private readonly backpressure?: Backpressure;

  constructor(manifest: ProtocolManifest, options: TransportOptions = {}) {
    this.manifest = manifest;
    this.options = options;

    // Determine base URL: override > mock > manifest
    this.baseUrl = this.resolveBaseUrl();

    // Prepare headers
    this.headers = {
      'Content-Type': 'application/json',
      ...manifest.default_headers,
      ...options.headers,
    };

    // Add authentication header
    this.addAuthHeader();

    // Resilience: merge protocol + options
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

  /**
   * Resolve the base URL for API requests
   */
  private resolveBaseUrl(): string {
    // Check for explicit override
    if (this.options.baseUrlOverride) {
      return this.options.baseUrlOverride;
    }

    // Check for mock server (testing mode)
    const mockUrl = process.env.MOCK_HTTP_URL;
    if (mockUrl) {
      return mockUrl;
    }

    // Check for proxy URL
    if (this.options.proxyUrl) {
      return this.options.proxyUrl;
    }

    // Use manifest base URL
    return this.manifest.base_url ?? '';
  }

  /**
   * Add authentication header based on manifest config
   */
  private addAuthHeader(): void {
    const auth = this.manifest.auth;
    if (!auth) {
      // Try to get API key from environment variable
      const envKey = this.getApiKeyFromEnv();
      if (envKey) {
        this.headers['Authorization'] = `Bearer ${envKey}`;
      }
      return;
    }

    let apiKey: string | undefined;

    // Get API key from environment variable
    if (auth.env_var) {
      apiKey = process.env[auth.env_var];
    } else {
      apiKey = this.getApiKeyFromEnv();
    }

    if (!apiKey) {
      return;
    }

    // Apply authentication based on type
    switch (auth.type) {
      case 'bearer':
        this.headers['Authorization'] = `Bearer ${apiKey}`;
        break;
      case 'api_key':
        if (auth.header_name) {
          this.headers[auth.header_name] = apiKey;
        } else {
          this.headers['x-api-key'] = apiKey;
        }
        break;
      case 'header':
        if (auth.header_name) {
          this.headers[auth.header_name] = apiKey;
        }
        break;
    }
  }

  /**
   * Get API key from environment variable
   */
  private getApiKeyFromEnv(): string | undefined {
    const providerId = this.manifest.id.toUpperCase().replace(/-/g, '_');
    return process.env[`${providerId}_API_KEY`] ?? process.env.AI_API_KEY;
  }

  /**
   * Get the endpoint path for chat completions
   */
  private getChatEndpoint(): string {
    const endpoints = this.manifest.endpoints;
    if (endpoints?.chat?.path) {
      return endpoints.chat.path;
    }
    return '/v1/chat/completions';
  }

  /**
   * Execute a non-streaming request
   */
  async execute(
    request: UnifiedRequest
  ): Promise<TransportResponse<UnifiedResponse>> {
    const startTime = Date.now();
    const endpoint = this.getChatEndpoint();
    const url = `${this.baseUrl}${endpoint}`;

    const doRequest = async (): Promise<TransportResponse<UnifiedResponse>> => {
      const controller = new AbortController();
      const timeout = this.options.timeout ?? 60000;
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify(request),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.text().catch(() => '');
          throw AiLibError.fromHttpStatus(
            response.status,
            errorBody || response.statusText
          );
        }

        const data = (await response.json()) as UnifiedResponse;
        return {
          data,
          stats: {
            latencyMs: Date.now() - startTime,
            retryCount: 0,
            endpoint,
            requestId: response.headers.get('x-request-id') ?? undefined,
            usage: data.usage,
          },
        };
      } catch (e) {
        clearTimeout(timeoutId);
        throw this.normalizeError(e);
      }
    };

    let op: () => Promise<TransportResponse<UnifiedResponse>> = doRequest;

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

  /**
   * Execute a streaming request
   * @param request - Chat request
   * @param options - Optional AbortSignal for cancellation
   */
  async *executeStream(
    request: UnifiedRequest,
    options?: { signal?: AbortSignal }
  ): AsyncGenerator<StreamingEvent, CallStats, unknown> {
    const startTime = Date.now();
    const endpoint = this.getChatEndpoint();
    const url = `${this.baseUrl}${endpoint}`;

    // Ensure streaming is enabled
    const streamRequest = { ...request, stream: true };

    const controller = new AbortController();
    const timeout = this.options.timeout ?? 120000;

    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Combine external signal with our controller
    const externalSignal = options?.signal;
    if (externalSignal) {
      externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    let requestId: string | undefined;
    let usage: CallStats['usage'];

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(streamRequest),
        signal: controller.signal,
      });

      requestId = response.headers.get('x-request-id') ?? undefined;

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw AiLibError.fromHttpStatus(
          response.status,
          errorBody || response.statusText
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw AiLibError.unknown('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process SSE frames
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();

          if (!trimmed || !trimmed.startsWith('data: ')) {
            continue;
          }

          const data = trimmed.slice(6);

          if (data === '[DONE]') {
            // Stream ended
            yield {
              event_type: 'StreamEnd',
            } as StreamingEvent;
            continue;
          }

          try {
            const parsed = JSON.parse(data) as Record<string, unknown>;

            // Parse as streaming event
            const events = this.parseStreamingEvent(parsed);
            for (const event of events) {
              // Capture usage from metadata
              if (event.event_type === 'Metadata' && event.usage) {
                usage = event.usage as CallStats['usage'];
              }
              yield event;
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    } finally {
      clearTimeout(timeoutId);
    }

    // Return final stats
    return {
      latencyMs: Date.now() - startTime,
      retryCount: 0,
      requestId,
      endpoint,
      usage,
    };
  }

  /**
   * Parse a streaming event from provider response
   */
  private parseStreamingEvent(data: Record<string, unknown>): StreamingEvent[] {
    const events: StreamingEvent[] = [];

    // Handle OpenAI-style response
    const choices = data.choices as Array<Record<string, unknown>> | undefined;
    if (choices && choices.length > 0) {
      const choice = choices[0];
      if (!choice) {
        return events;
      }

      const delta = choice.delta as Record<string, unknown> | undefined;

      if (delta?.content) {
        events.push({
          event_type: 'PartialContentDelta',
          content: String(delta.content),
        });
      }

      if (delta?.tool_calls) {
        const toolCalls = delta.tool_calls as Array<Record<string, unknown>>;
        for (const tc of toolCalls) {
          const index = tc.index as number | undefined;
          const id = tc.id as string | undefined;
          const func = tc.function as Record<string, unknown> | undefined;

          if (id && func?.name) {
            events.push({
              event_type: 'ToolCallStarted',
              tool_call_id: id,
              tool_name: String(func.name),
              index,
            });
          }

          if (func?.arguments && id) {
            events.push({
              event_type: 'PartialToolCall',
              tool_call_id: id,
              arguments: String(func.arguments),
              index,
            });
          }
        }
      }

      const finishReason = choice.finish_reason as string | undefined;
      if (finishReason) {
        events.push({
          event_type: 'Metadata',
          finish_reason: finishReason,
        });
      }
    }

    // Handle usage in response
    const usage = data.usage as Record<string, unknown> | undefined;
    if (usage) {
      events.push({
        event_type: 'Metadata',
        usage,
      });
    }

    // Handle error
    const error = data.error as Record<string, unknown> | undefined;
    if (error) {
      events.push({
        event_type: 'StreamError',
        error,
      });
    }

    return events;
  }

  /**
   * Normalize error to AiLibError
   */
  private normalizeError(error: unknown): AiLibError {
    if (error instanceof AiLibError) {
      return error;
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return AiLibError.timeout('Request timed out');
      }
      return AiLibError.unknown(error.message, error);
    }

    return AiLibError.unknown(String(error));
  }

}

/**
 * Create a transport instance
 */
export function createTransport(
  manifest: ProtocolManifest,
  options?: TransportOptions
): HttpTransport {
  return new HttpTransport(manifest, options);
}
