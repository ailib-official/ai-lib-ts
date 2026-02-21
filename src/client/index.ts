/**
 * Unified AI Client for AI-Protocol TypeScript Runtime
 *
 * Provides a single entry point for all AI interactions with any provider.
 */

import type { Message, ToolDefinition, ToolChoice, StreamingEvent } from '../types/index.js';
import type { ProtocolManifest, UnifiedRequest } from '../protocol/index.js';
import { ProtocolLoader } from '../protocol/index.js';
import { HttpTransport, MOCK_SERVER_URL } from '../transport/index.js';
import type { TransportOptions, CallStats } from '../transport/index.js';
import { CancelHandle } from '../streaming/cancel.js';

/**
 * Client builder options
 */
export interface ClientOptions extends TransportOptions {
  protocolPath?: string;
  fallbacks?: string[];
  strictStreaming?: boolean;
}

/**
 * Chat request builder options
 */
export interface ChatOptions {
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
  tools?: ToolDefinition[];
  toolChoice?: ToolChoice;
  stream?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Unified response from the client
 */
export interface Response {
  content: string;
  toolCalls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  finishReason?: string;
}

/**
 * Chat request builder
 */
export class ChatBuilder {
  private options: ChatOptions;

  constructor(
    private readonly client: AiClient,
    messages: Message[]
  ) {
    this.options = { messages };
  }

  temperature(value: number): this {
    this.options.temperature = value;
    return this;
  }

  maxTokens(value: number): this {
    this.options.maxTokens = value;
    return this;
  }

  topP(value: number): this {
    this.options.topP = value;
    return this;
  }

  frequencyPenalty(value: number): this {
    this.options.frequencyPenalty = value;
    return this;
  }

  presencePenalty(value: number): this {
    this.options.presencePenalty = value;
    return this;
  }

  stopSequences(sequences: string[]): this {
    this.options.stopSequences = sequences;
    return this;
  }

  tools(tools: ToolDefinition[]): this {
    this.options.tools = tools;
    return this;
  }

  toolChoice(choice: ToolChoice): this {
    this.options.toolChoice = choice;
    return this;
  }

  stream(): this {
    this.options.stream = true;
    return this;
  }

  metadata(meta: Record<string, unknown>): this {
    this.options.metadata = meta;
    return this;
  }

  async execute(): Promise<Response> {
    return this.client.executeChat(this.options);
  }

  executeStream(): AsyncGenerator<StreamingEvent, CallStats, unknown> {
    return this.client.executeChatStream({ ...this.options, stream: true });
  }

  /**
   * Execute streaming with cancel support
   */
  executeStreamWithCancel(): {
    stream: AsyncGenerator<StreamingEvent, CallStats, unknown>;
    cancelHandle: CancelHandle;
  } {
    const cancelHandle = new CancelHandle();
    const stream = this.client.executeChatStream(
      { ...this.options, stream: true },
      { signal: cancelHandle.signal }
    );
    return { stream, cancelHandle };
  }
}

/**
 * Unified AI Client
 */
export class AiClient {
  constructor(
    readonly manifest: ProtocolManifest,
    readonly transport: HttpTransport,
    readonly modelId: string
  ) {}

  static async new(model: string, options: ClientOptions = {}): Promise<AiClient> {
    const builder = new AiClientBuilder();
    if (options.protocolPath) builder.withProtocolPath(options.protocolPath);
    if (options.baseUrlOverride) builder.withBaseUrl(options.baseUrlOverride);
    if (options.timeout) builder.withTimeout(options.timeout);
    return builder.build(model);
  }

  chat(messages: Message[]): ChatBuilder {
    return new ChatBuilder(this, messages);
  }

  async executeChat(options: ChatOptions): Promise<Response> {
    const request = this.buildRequest(options);
    const { data } = await this.transport.execute(request);

    return {
      content: data.content ?? '',
      toolCalls: data.tool_calls,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
      finishReason: data.finish_reason,
    };
  }

  async *executeChatStream(
    options: ChatOptions,
    streamOptions?: { signal?: AbortSignal }
  ): AsyncGenerator<StreamingEvent, CallStats, unknown> {
    const request = this.buildRequest(options);
    return yield* this.transport.executeStream(request, streamOptions);
  }

  private buildRequest(options: ChatOptions): UnifiedRequest {
    const request: UnifiedRequest = {
      model: this.modelId,
      messages: options.messages.map((m) => {
        const msg: { role: string; content: unknown; tool_call_id?: string } = {
          role: m.role,
          content: m.content,
        };
        if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
        return msg;
      }),
      stream: options.stream ?? false,
    };

    if (options.temperature !== undefined) request.temperature = options.temperature;
    if (options.maxTokens !== undefined) request.max_tokens = options.maxTokens;
    if (options.topP !== undefined) request.top_p = options.topP;
    if (options.frequencyPenalty !== undefined) request.frequency_penalty = options.frequencyPenalty;
    if (options.presencePenalty !== undefined) request.presence_penalty = options.presencePenalty;
    if (options.stopSequences !== undefined) request.stop_sequences = options.stopSequences;
    if (options.tools !== undefined) request.tools = options.tools;
    if (options.toolChoice !== undefined) request.tool_choice = options.toolChoice;
    if (options.metadata !== undefined) request.metadata = options.metadata;

    return request;
  }

  get model(): string { return this.modelId; }
  get provider(): string { return this.manifest.id; }
}

/**
 * Client builder for configuring AI clients
 */
export class AiClientBuilder {
  private protocolPath?: string;
  private baseUrl?: string;
  private timeout?: number;
  private headers?: Record<string, string>;

  withProtocolPath(path: string): this {
    this.protocolPath = path;
    return this;
  }

  withBaseUrl(url: string): this {
    this.baseUrl = url;
    return this;
  }

  withMockServer(url: string = MOCK_SERVER_URL): this {
    this.baseUrl = url;
    return this;
  }

  withTimeout(ms: number): this {
    this.timeout = ms;
    return this;
  }

  withHeaders(headers: Record<string, string>): this {
    this.headers = headers;
    return this;
  }

  async build(model: string): Promise<AiClient> {
    const loader = new ProtocolLoader({ protocolPath: this.protocolPath });
    const manifest = await loader.load(model);

    const baseUrl = this.baseUrl ?? process.env.MOCK_HTTP_URL;

    const transport = new HttpTransport(manifest, {
      baseUrlOverride: baseUrl,
      timeout: this.timeout,
      headers: this.headers,
    });

    return new AiClient(manifest, transport, manifest.model_id);
  }
}

export function createClientBuilder(): AiClientBuilder {
  return new AiClientBuilder();
}

export async function createClient(model: string, options?: ClientOptions): Promise<AiClient> {
  return AiClient.new(model, options);
}
