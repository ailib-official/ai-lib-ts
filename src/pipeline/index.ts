/**
 * Streaming pipeline for processing SSE responses
 *
 * Implements the operator-based architecture from AI-Protocol:
 * Decoder → Selector → Accumulator → EventMapper
 */

import type { StreamingEvent } from '../types/index.js';

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

/**
 * Create OpenAI event mapper
 */
export function createOpenAiEventMapper(): EventMapper {
  return {
    process(data: Record<string, unknown>): StreamingEvent[] {
      const events: StreamingEvent[] = [];

      const choices = data.choices as Array<Record<string, unknown>> | undefined;
      if (!choices || choices.length === 0) {
        return events;
      }

      const choice = choices[0];
      if (!choice) {
        return events;
      }

      const delta = choice.delta as Record<string, unknown> | undefined;
      const index = choice.index as number | undefined;

      // Content delta
      if (delta?.content) {
        events.push({
          event_type: 'PartialContentDelta',
          content: String(delta.content),
          sequence_id: index,
        });
      }

      // Tool calls
      const toolCalls = delta?.tool_calls as Array<Record<string, unknown>> | undefined;
      if (toolCalls) {
        for (const tc of toolCalls) {
          const tcIndex = tc.index as number | undefined;
          const id = tc.id as string | undefined;
          const func = tc.function as Record<string, unknown> | undefined;

          if (id && func?.name) {
            events.push({
              event_type: 'ToolCallStarted',
              tool_call_id: id,
              tool_name: String(func.name),
              index: tcIndex,
            });
          }

          if (func?.arguments && id) {
            events.push({
              event_type: 'PartialToolCall',
              tool_call_id: id,
              arguments: String(func.arguments),
              index: tcIndex,
              is_complete: false,
            });
          }
        }
      }

      // Finish reason
      const finishReason = choice.finish_reason as string | undefined;
      if (finishReason) {
        events.push({
          event_type: 'Metadata',
          finish_reason: finishReason,
        });
      }

      // Usage
      const usage = data.usage as Record<string, unknown> | undefined;
      if (usage) {
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
