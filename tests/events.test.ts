/**
 * Tests for Streaming Events
 */

import { describe, it, expect } from 'vitest';
import { StreamingEvent, TerminationReason } from '../src/types/index.ts';

describe('StreamingEvent', () => {
  it('should create PartialContentDelta event', () => {
    const event = StreamingEvent.partialContentDelta('Hello', 1);
    expect(event.event_type).toBe('PartialContentDelta');
    if (event.event_type !== 'PartialContentDelta') {
      throw new Error('expected PartialContentDelta');
    }
    expect(event.content).toBe('Hello');
    expect(event.sequence_id).toBe(1);
  });

  it('should create ThinkingDelta event', () => {
    const event = StreamingEvent.thinkingDelta('Let me think...', 'maybe use tool');
    expect(event.event_type).toBe('ThinkingDelta');
    if (event.event_type !== 'ThinkingDelta') {
      throw new Error('expected ThinkingDelta');
    }
    expect(event.thinking).toBe('Let me think...');
    expect(event.tool_consideration).toBe('maybe use tool');
  });

  it('should create ToolCallStarted event', () => {
    const event = StreamingEvent.toolCallStarted('call_123', 'get_weather', 0);
    expect(event.event_type).toBe('ToolCallStarted');
    if (event.event_type !== 'ToolCallStarted') {
      throw new Error('expected ToolCallStarted');
    }
    expect(event.tool_call_id).toBe('call_123');
    expect(event.tool_name).toBe('get_weather');
  });

  it('should create PartialToolCall event', () => {
    const event = StreamingEvent.partialToolCall('call_123', '{"location":', 0, false);
    expect(event.event_type).toBe('PartialToolCall');
    if (event.event_type !== 'PartialToolCall') {
      throw new Error('expected PartialToolCall');
    }
    expect(event.arguments).toBe('{"location":');
    expect(event.is_complete).toBe(false);
  });

  it('should create ToolCallEnded event', () => {
    const event = StreamingEvent.toolCallEnded('call_123', 0);
    expect(event.event_type).toBe('ToolCallEnded');
    if (event.event_type !== 'ToolCallEnded') {
      throw new Error('expected ToolCallEnded');
    }
    expect(event.tool_call_id).toBe('call_123');
  });

  it('should create Metadata event', () => {
    const usage = { prompt_tokens: 10, completion_tokens: 20 };
    const event = StreamingEvent.metadata(usage, 'stop', 'end_turn');
    expect(event.event_type).toBe('Metadata');
    if (event.event_type !== 'Metadata') {
      throw new Error('expected Metadata');
    }
    expect(event.usage).toEqual(usage);
    expect(event.finish_reason).toBe('stop');
    expect(event.stop_reason).toBe('end_turn');
  });

  it('should create StreamEnd event', () => {
    const event = StreamingEvent.streamEnd('stop');
    expect(event.event_type).toBe('StreamEnd');
    if (event.event_type !== 'StreamEnd') {
      throw new Error('expected StreamEnd');
    }
    expect(event.finish_reason).toBe('stop');
  });

  it('should create StreamError event', () => {
    const error = { message: 'Rate limited', code: 429 };
    const event = StreamingEvent.streamError(error, 'evt_001');
    expect(event.event_type).toBe('StreamError');
    if (event.event_type !== 'StreamError') {
      throw new Error('expected StreamError');
    }
    expect(event.error).toEqual(error);
    expect(event.event_id).toBe('evt_001');
  });

  it('should create FinalCandidate event', () => {
    const event = StreamingEvent.finalCandidate(0, 'stop');
    expect(event.event_type).toBe('FinalCandidate');
    if (event.event_type !== 'FinalCandidate') {
      throw new Error('expected FinalCandidate');
    }
    expect(event.candidate_index).toBe(0);
    expect(event.finish_reason).toBe('stop');
  });
});

describe('TerminationReason', () => {
  it('should have all standard reasons', () => {
    expect(TerminationReason.END_TURN).toBe('end_turn');
    expect(TerminationReason.MAX_TOKENS).toBe('max_tokens');
    expect(TerminationReason.STOP_SEQUENCE).toBe('stop_sequence');
    expect(TerminationReason.TOOL_USE).toBe('tool_use');
    expect(TerminationReason.REFUSAL).toBe('refusal');
    expect(TerminationReason.PAUSE_TURN).toBe('pause_turn');
    expect(TerminationReason.OTHER).toBe('other');
  });
});
