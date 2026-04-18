/**
 * Streaming pipeline for processing SSE responses
 *
 * Implements the operator-based architecture from AI-Protocol:
 * Decoder → Selector → Accumulator → EventMapper
 */

import type { StreamingEvent } from '../types/index.js';
import type { ProtocolManifest } from '../protocol/manifest.js';
import { getStringAtPath, getValueAtPath } from '../protocol/jsonPath.js';

/**
 * Pipeline operator interface
 */
export interface PipelineOperator<Input, Output> {
  process(input: Input): Output;
}

/**
 * Decoder: Parse raw bytes to frames
 */
export type Decoder = PipelineOperator<string, string[]>;

/**
 * Selector: Filter frames based on conditions
 */
export type Selector = PipelineOperator<string, boolean>;

/**
 * Event mapper: Transform frames to events
 */
export type EventMapper = PipelineOperator<Record<string, unknown>, StreamingEvent[]>;

/**
 * Create SSE decoder
 */
export function createSseDecoder(): Decoder {
  let buffer = '';

  return {
    process(chunk: string): string[] {
      buffer += chunk;
      const frames: string[] = [];

      // Split by double newline (SSE frame delimiter)
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        // Extract data lines
        const lines = part.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data !== '[DONE]') {
              frames.push(data);
            }
          }
        }
      }

      return frames;
    },
  };
}

/**
 * Create JSON selector
 */
export function createJsonSelector(): Selector {
  return {
    process(frame: string): boolean {
      try {
        JSON.parse(frame);
        return true;
      } catch {
        return false;
      }
    },
  };
}

export interface OpenAiPathMapperOptions {
  contentPath: string;
  toolCallPath: string;
  usagePath: string;
  finishReasonPath?: string;
}

/**
 * OpenAI-compatible SSE mapper using manifest paths (Rust/Python `PathEventMapper` parity).
 */
export function createOpenAiEventMapperWithPaths(opts: OpenAiPathMapperOptions): EventMapper {
  const finishPath = opts.finishReasonPath ?? 'choices[0].finish_reason';
  // Track index -> id mapping for tool calls
  const toolCallIds: Map<number, string> = new Map();
  return {
    process(data: Record<string, unknown>): StreamingEvent[] {
      const events: StreamingEvent[] = [];

      if (data.error) {
        events.push({
          event_type: 'StreamError',
          error: data.error as Record<string, unknown>,
        });
        return events;
      }

      const reasoning = getStringAtPath(data, 'choices[0].delta.reasoning_content');
      if (reasoning) {
        events.push({
          event_type: 'ThinkingDelta',
          thinking: reasoning,
        });
      }

      const indexRaw = getValueAtPath(data, 'choices[0].index');
      const index = typeof indexRaw === 'number' ? indexRaw : undefined;

      const contentRaw = getValueAtPath(data, opts.contentPath);
      if (contentRaw !== undefined && contentRaw !== null && String(contentRaw) !== '') {
        events.push({
          event_type: 'PartialContentDelta',
          content: String(contentRaw),
          sequence_id: index,
        });
      }

      const toolCalls = getValueAtPath(data, opts.toolCallPath) as Array<Record<string, unknown>> | undefined;
      if (toolCalls && Array.isArray(toolCalls)) {
        for (const tc of toolCalls) {
          const tcIndex = tc.index as number | undefined;
          const id = tc.id as string | undefined;
          const func = tc.function as Record<string, unknown> | undefined;

          if (id && func?.name) {
          // Remember index -> id mapping
          if (tcIndex !== undefined) {
            toolCallIds.set(tcIndex, id);
          }
            events.push({
              event_type: 'ToolCallStarted',
              tool_call_id: id,
              tool_name: String(func.name),
              index: tcIndex,
            });
          }

        if (func?.arguments) {
          // Look up id by index if not present
          const resolvedId = id ?? (tcIndex !== undefined ? toolCallIds.get(tcIndex) : undefined);
          if (resolvedId) {
            events.push({
              event_type: 'PartialToolCall',
              tool_call_id: resolvedId,
              arguments: String(func.arguments),
              index: tcIndex,
              is_complete: false,
            });
          }
          }
        }
      }

      const finishReason = getStringAtPath(data, finishPath);
      if (finishReason) {
        events.push({
          event_type: 'Metadata',
          finish_reason: finishReason,
        });
      }

      const usage = getValueAtPath(data, opts.usagePath) as Record<string, unknown> | undefined;
      if (usage && typeof usage === 'object' && !Array.isArray(usage)) {
        events.push({
          event_type: 'Metadata',
          usage,
        });
      }

      return events;
    },
  };
}

/**
 * Create OpenAI event mapper (default streaming paths).
 */
export function createOpenAiEventMapper(): EventMapper {
  return createOpenAiEventMapperWithPaths({
    contentPath: 'choices[0].delta.content',
    toolCallPath: 'choices[0].delta.tool_calls',
    usagePath: 'usage',
    finishReasonPath: 'choices[0].finish_reason',
  });
}

/**
 * Create Anthropic event mapper
 */
export function createAnthropicEventMapper(): EventMapper {
  return {
    process(data: Record<string, unknown>): StreamingEvent[] {
      const events: StreamingEvent[] = [];
      const type = data.type as string | undefined;

      switch (type) {
        case 'content_block_delta': {
          const delta = data.delta as Record<string, unknown> | undefined;
          const index = data.index as number | undefined;

          if (delta?.type === 'text_delta' && delta.text) {
            events.push({
              event_type: 'PartialContentDelta',
              content: String(delta.text),
              sequence_id: index,
            });
        }
        if (delta?.type === 'thinking_delta' && delta.thinking) {
          events.push({
            event_type: 'ThinkingDelta',
            thinking: String(delta.thinking),
          });
          }

          if (delta?.type === 'input_json_delta' && delta.partial_json) {
            const toolUseId = `tool_${index}`;
            events.push({
              event_type: 'PartialToolCall',
              tool_call_id: toolUseId,
              arguments: String(delta.partial_json),
              index,
              is_complete: false,
            });
          }
          break;
        }

        case 'content_block_start': {
          const contentBlock = data.content_block as Record<string, unknown> | undefined;
          const index = data.index as number | undefined;

          if (contentBlock?.type === 'tool_use') {
            events.push({
              event_type: 'ToolCallStarted',
              tool_call_id: contentBlock.id as string,
              tool_name: contentBlock.name as string,
              index,
            });
          }
          break;
        }

        case 'content_block_stop': {
          const index = data.index as number | undefined;
          events.push({
            event_type: 'ToolCallEnded',
            tool_call_id: `tool_${index}`,
            index,
          });
          break;
        }

        case 'message_delta': {
          const delta = data.delta as Record<string, unknown> | undefined;
          const usage = data.usage as Record<string, unknown> | undefined;

          if (delta?.stop_reason) {
            events.push({
              event_type: 'Metadata',
              stop_reason: String(delta.stop_reason),
            });
          }

          if (usage) {
            events.push({
              event_type: 'Metadata',
              usage,
            });
          }
          break;
        }

        case 'message_stop': {
          events.push({
            event_type: 'StreamEnd',
          });
          break;
        }

        case 'error': {
          const error = data.error as Record<string, unknown> | undefined;
          events.push({
            event_type: 'StreamError',
            error: error ?? data,
          });
          break;
        }
      }

      return events;
    },
  };
}

/**
 * Streaming pipeline class
 */
export class Pipeline {
  private readonly decoder: Decoder;
  private readonly selector: Selector;
  private readonly eventMapper: EventMapper;

  constructor(
    decoder: Decoder = createSseDecoder(),
    selector: Selector = createJsonSelector(),
    eventMapper: EventMapper = createOpenAiEventMapper()
  ) {
    this.decoder = decoder;
    this.selector = selector;
    this.eventMapper = eventMapper;
  }

  /**
   * Process a chunk of data and return events
   */
  process(chunk: string): StreamingEvent[] {
    const frames = this.decoder.process(chunk);
    const events: StreamingEvent[] = [];

    for (const frame of frames) {
      if (!this.selector.process(frame)) {
        continue;
      }

      try {
        const data = JSON.parse(frame) as Record<string, unknown>;
        const frameEvents = this.eventMapper.process(data);
        events.push(...frameEvents);
      } catch {
        // Skip invalid JSON
      }
    }

    return events;
  }

  /**
   * Create pipeline for a specific provider format
   */
  static forProvider(format: string): Pipeline {
    switch (format) {
      case 'anthropic_sse':
        return new Pipeline(
          createSseDecoder(),
          createJsonSelector(),
          createAnthropicEventMapper()
        );
      case 'openai_sse':
      default:
        return new Pipeline(
          createSseDecoder(),
          createJsonSelector(),
          createOpenAiEventMapper()
        );
    }
  }

  /**
   * Create pipeline from protocol manifest.
   * Infers decoder/event mapper from manifest streaming config and provider id.
   */
  static fromManifest(manifest: ProtocolManifest): Pipeline {
    const strategy = manifest.streaming?.decoder?.strategy?.toLowerCase() ?? '';
    const providerId = manifest.id?.toLowerCase() ?? '';
    if (strategy === 'anthropic_event_stream' || providerId.includes('anthropic')) {
      return Pipeline.forProvider('anthropic_sse');
    }
    const st = manifest.streaming;
    const contentPath = st?.content_path ?? 'choices[0].delta.content';
    const toolCallPath = st?.tool_call_path ?? 'choices[0].delta.tool_calls';
    const usagePath = st?.usage_path ?? 'usage';
    return new Pipeline(
      createSseDecoder(),
      createJsonSelector(),
      createOpenAiEventMapperWithPaths({
        contentPath,
        toolCallPath,
        usagePath,
        finishReasonPath: 'choices[0].finish_reason',
      })
    );
  }
}

/**
 * Create a default pipeline
 */
export function createPipeline(format?: string): Pipeline {
  if (format) {
    return Pipeline.forProvider(format);
  }
  return new Pipeline();
}

/**
 * Tool call accumulator for merging partial tool call arguments
 */
export class ToolCallAccumulator {
  private accumulated: Map<string, { id: string; name: string; arguments: string }> = new Map();

  /**
   * Accumulate a partial tool call event
   */
  accumulate(event: { tool_call_id: string; tool_name?: string; arguments: string; is_complete?: boolean }): {
    id: string;
    name: string;
    arguments: string;
    is_complete: boolean;
  } | null {
    const id = event.tool_call_id;
    const existing = this.accumulated.get(id);

    if (existing) {
      existing.arguments += event.arguments;
      return {
        id,
        name: existing.name,
        arguments: existing.arguments,
        is_complete: event.is_complete ?? false,
      };
    }

    if (event.tool_name) {
      this.accumulated.set(id, {
        id,
        name: event.tool_name,
        arguments: event.arguments,
      });
      return {
        id,
        name: event.tool_name,
        arguments: event.arguments,
        is_complete: event.is_complete ?? false,
      };
    }

    return null;
  }

  /**
   * Get all accumulated tool calls
   */
  getAll(): Array<{ id: string; name: string; arguments: string }> {
    return Array.from(this.accumulated.values());
  }

  /**
   * Clear accumulated state
   */
  clear(): void {
    this.accumulated.clear();
  }
}
