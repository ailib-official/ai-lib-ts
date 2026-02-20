/**
 * Streaming events based on AI-Protocol standard_schema
 */

/**
 * Unified streaming event types
 */
export type StreamingEvent =
  | { event_type: 'PartialContentDelta'; content: string; sequence_id?: number }
  | { event_type: 'ThinkingDelta'; thinking: string; tool_consideration?: string }
  | { event_type: 'ToolCallStarted'; tool_call_id: string; tool_name: string; index?: number }
  | {
      event_type: 'PartialToolCall';
      tool_call_id: string;
      arguments: string;
      index?: number;
      is_complete?: boolean;
    }
  | { event_type: 'ToolCallEnded'; tool_call_id: string; index?: number }
  | {
      event_type: 'Metadata';
      usage?: unknown;
      finish_reason?: string;
      stop_reason?: string;
    }
  | { event_type: 'FinalCandidate'; candidate_index: number; finish_reason: string }
  | { event_type: 'StreamEnd'; finish_reason?: string }
  | { event_type: 'StreamError'; error: unknown; event_id?: string };

/**
 * Streaming event factory functions
 */
export const StreamingEvent = {
  partialContentDelta(content: string, sequenceId?: number): StreamingEvent {
    const event: StreamingEvent = {
      event_type: 'PartialContentDelta',
      content,
    };
    if (sequenceId !== undefined) {
      event.sequence_id = sequenceId;
    }
    return event;
  },

  thinkingDelta(thinking: string, toolConsideration?: string): StreamingEvent {
    const event: StreamingEvent = {
      event_type: 'ThinkingDelta',
      thinking,
    };
    if (toolConsideration) {
      event.tool_consideration = toolConsideration;
    }
    return event;
  },

  toolCallStarted(toolCallId: string, toolName: string, index?: number): StreamingEvent {
    const event: StreamingEvent = {
      event_type: 'ToolCallStarted',
      tool_call_id: toolCallId,
      tool_name: toolName,
    };
    if (index !== undefined) {
      event.index = index;
    }
    return event;
  },

  partialToolCall(
    toolCallId: string,
    args: string,
    index?: number,
    isComplete?: boolean
  ): StreamingEvent {
    const event: StreamingEvent = {
      event_type: 'PartialToolCall',
      tool_call_id: toolCallId,
      arguments: args,
    };
    if (index !== undefined) {
      event.index = index;
    }
    if (isComplete !== undefined) {
      event.is_complete = isComplete;
    }
    return event;
  },

  toolCallEnded(toolCallId: string, index?: number): StreamingEvent {
    const event: StreamingEvent = {
      event_type: 'ToolCallEnded',
      tool_call_id: toolCallId,
    };
    if (index !== undefined) {
      event.index = index;
    }
    return event;
  },

  metadata(usage?: unknown, finishReason?: string, stopReason?: string): StreamingEvent {
    const event: StreamingEvent = {
      event_type: 'Metadata',
    };
    if (usage !== undefined) {
      event.usage = usage;
    }
    if (finishReason) {
      event.finish_reason = finishReason;
    }
    if (stopReason) {
      event.stop_reason = stopReason;
    }
    return event;
  },

  streamEnd(finishReason?: string): StreamingEvent {
    const event: StreamingEvent = {
      event_type: 'StreamEnd',
    };
    if (finishReason) {
      event.finish_reason = finishReason;
    }
    return event;
  },

  streamError(error: unknown, eventId?: string): StreamingEvent {
    const event: StreamingEvent = {
      event_type: 'StreamError',
      error,
    };
    if (eventId) {
      event.event_id = eventId;
    }
    return event;
  },
};

/**
 * Standard termination reasons from AI-Protocol
 */
export const TerminationReason = {
  END_TURN: 'end_turn',
  MAX_TOKENS: 'max_tokens',
  STOP_SEQUENCE: 'stop_sequence',
  TOOL_USE: 'tool_use',
  REFUSAL: 'refusal',
  PAUSE_TURN: 'pause_turn',
  OTHER: 'other',
} as const;

export type TerminationReasonType = (typeof TerminationReason)[keyof typeof TerminationReason];
