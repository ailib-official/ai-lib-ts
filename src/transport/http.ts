/**
 * E-layer HTTP transport — fetch/SSE only (no resilience decorators).
 */

import type { ProtocolManifest, UnifiedRequest, UnifiedResponse } from '../protocol/manifest.js';
import { AiLibError } from '../errors/index.js';
import type { StreamingEvent } from '../types/index.js';
import {
  buildAuthMetadata,
  resolveCredential,
  type ResolvedCredential,
} from './credentials.js';

export * from './credentials.js';

/** Local mock default when test mode explicitly allows redirect. */
export const MOCK_SERVER_DEFAULT = 'http://127.0.0.1:4010';

/**
 * Mock server URL for testing — only honored when {@link resolveMockBaseUrl} allows it.
 */
export const MOCK_SERVER_URL =
  process.env.MOCK_HTTP_URL ?? MOCK_SERVER_DEFAULT;

/**
 * Whether MOCK_HTTP_URL may override the manifest base URL.
 */
export function isMockUrlAllowed(): boolean {
  return (
    process.env.AILIB_ALLOW_MOCK_URL === '1' || process.env.NODE_ENV === 'test'
  );
}

/**
 * Resolve mock base URL when allowed; otherwise undefined.
 */
export function resolveMockBaseUrl(): string | undefined {
  if (!isMockUrlAllowed()) {
    return undefined;
  }
  return process.env.MOCK_HTTP_URL ?? MOCK_SERVER_DEFAULT;
}

/**
 * Transport options (E-layer; resilience lives in contact/P transport wrapper).
 */
export interface TransportOptions {
  baseUrlOverride?: string;
  timeout?: number;
  headers?: Record<string, string>;
  credential?: string;
  proxyUrl?: string;
}

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

export interface TransportResponse<T> {
  data: T;
  stats: CallStats;
}

/**
 * E-layer HTTP transport (no retry / circuit breaker / rate limit).
 */
export class HttpTransport {
  protected readonly manifest: ProtocolManifest;
  protected readonly options: TransportOptions;
  protected readonly baseUrl: string;
  protected readonly headers: Record<string, string>;
  protected readonly authQueryParams: Record<string, string>;
  protected readonly credential: ResolvedCredential;

  constructor(manifest: ProtocolManifest, options: TransportOptions = {}) {
    this.manifest = manifest;
    this.options = options;
    this.baseUrl = this.resolveBaseUrl();

    this.credential = resolveCredential(manifest, options.credential);
    const authMetadata = buildAuthMetadata(manifest, this.credential);
    this.authQueryParams = authMetadata.queryParams;

    this.headers = {
      'Content-Type': 'application/json',
      ...manifest.default_headers,
      ...authMetadata.headers,
      ...options.headers,
    };
  }

  protected resolveBaseUrl(): string {
    if (this.options.baseUrlOverride) {
      return this.options.baseUrlOverride;
    }

    const mockUrl = resolveMockBaseUrl();
    if (mockUrl) {
      return mockUrl;
    }

    if (this.options.proxyUrl) {
      return this.options.proxyUrl;
    }

    return this.manifest.endpoint?.base_url ?? this.manifest.base_url ?? '';
  }

  /** Resolved base URL (no trailing slash). */
  get resolvedBaseUrl(): string {
    return this.baseUrl.replace(/\/$/, '');
  }

  protected getChatEndpoint(): string {
    const endpoints = this.manifest.endpoints;
    if (endpoints?.chat?.path) {
      return endpoints.chat.path;
    }
    return '/v1/chat/completions';
  }

  protected buildUrl(endpoint: string): string {
    // Absolute L-Exec maps (e.g. DashScope multimodal) bypass base_url join.
    const url = /^https?:\/\//i.test(endpoint)
      ? new URL(endpoint)
      : new URL(
          `${this.resolvedBaseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`,
        );
    for (const [key, value] of Object.entries(this.authQueryParams)) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  }

  /**
   * Build headers for a request. When `forMultipart` is true, omit Content-Type
   * so fetch sets the multipart boundary.
   */
  protected buildRequestHeaders(forMultipart = false): Record<string, string> {
    if (!forMultipart) {
      return { ...this.headers };
    }
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(this.headers)) {
      if (key.toLowerCase() !== 'content-type') {
        headers[key] = value;
      }
    }
    return headers;
  }

  /**
   * Generic POST on the shared fetch stack (JSON or multipart FormData).
   * Used by chat-adjacent APIs (embeddings/stt/tts/rerank) — [GOV-007].
   */
  async post(
    path: string,
    body: Record<string, unknown> | FormData,
    options?: { signal?: AbortSignal }
  ): Promise<Response> {
    const url = this.buildUrl(path);
    const forMultipart = typeof FormData !== 'undefined' && body instanceof FormData;
    const controller = new AbortController();
    const timeout = this.options.timeout ?? 60_000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const externalSignal = options?.signal;
    if (externalSignal) {
      externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.buildRequestHeaders(forMultipart),
        body: forMultipart ? body : JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw AiLibError.fromHttpStatus(
          response.status,
          errorBody || response.statusText
        );
      }

      return response;
    } catch (e) {
      throw this.normalizeError(e);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Build transport when only baseUrl + bearer secret are known.
   * Same constructor as protocol-driven clients — not a second HTTP stack ([GOV-007]).
   */
  static withExplicitBearer(options: {
    baseUrl: string;
    apiKey: string;
    timeout?: number;
  }): HttpTransport {
    const manifest = {
      id: 'explicit',
      protocol_version: '1.0',
      base_url: options.baseUrl,
      endpoint: {
        base_url: options.baseUrl,
        auth: { type: 'bearer' as const, token_env: 'AI_LIB_EXPLICIT_API_KEY' },
      },
      status: 'stable',
      model_id: 'explicit',
    } as unknown as ProtocolManifest;
    return new HttpTransport(manifest, {
      baseUrlOverride: options.baseUrl,
      credential: options.apiKey,
      timeout: options.timeout,
    });
  }

  async execute(
    request: UnifiedRequest
  ): Promise<TransportResponse<UnifiedResponse>> {
    const startTime = Date.now();
    const endpoint = this.getChatEndpoint();
    const url = this.buildUrl(endpoint);

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
  }

  async *executeStream(
    request: UnifiedRequest,
    options?: { signal?: AbortSignal }
  ): AsyncGenerator<StreamingEvent, CallStats, unknown> {
    const startTime = Date.now();
    const endpoint = this.getChatEndpoint();
    const url = this.buildUrl(endpoint);

    const streamRequest = { ...request, stream: true };

    const controller = new AbortController();
    const timeout = this.options.timeout ?? 120000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

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

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();

          if (!trimmed || !trimmed.startsWith('data: ')) {
            continue;
          }

          const data = trimmed.slice(6);

          if (data === '[DONE]') {
            yield {
              event_type: 'StreamEnd',
            } as StreamingEvent;
            continue;
          }

          try {
            const parsed = JSON.parse(data) as Record<string, unknown>;
            const events = this.parseStreamingEvent(parsed);
            for (const event of events) {
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

    return {
      latencyMs: Date.now() - startTime,
      retryCount: 0,
      requestId,
      endpoint,
      usage,
    };
  }

  protected parseStreamingEvent(data: Record<string, unknown>): StreamingEvent[] {
    const events: StreamingEvent[] = [];

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

    const usageData = data.usage as Record<string, unknown> | undefined;
    if (usageData) {
      events.push({
        event_type: 'Metadata',
        usage: usageData,
      });
    }

    const error = data.error as Record<string, unknown> | undefined;
    if (error) {
      events.push({
        event_type: 'StreamError',
        error,
      });
    }

    return events;
  }

  protected normalizeError(error: unknown): AiLibError {
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

export function createTransport(
  manifest: ProtocolManifest,
  options?: TransportOptions
): HttpTransport {
  return new HttpTransport(manifest, options);
}
