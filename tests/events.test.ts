/**
 * Tests for Streaming Events
 */

import { describe, it, expect } from 'vitest';
import { StreamingEvent, TerminationReason } from '../src/types/index.ts';

describe('StreamingEvent', () => {
  it('should create PartialContentDelta event', () => {
    const event = StreamingEvent.partialContentDelta('Hello', 1);
    expect(event.event_type).toBe('PartialContentDelta');
    expect(event.content).toBe('Hello');
    expect(event.sequence_id).toBe(1);
  });

  it('should create ThinkingDelta event', () => {
    const event = StreamingEvent.thinkingDelta('Let me think...', 'maybe use tool');
    expect(event.event_type).toBe('ThinkingDelta');
    expect(event.thinking).toBe('Let me think...');
    expect(event.tool_consideration).toBe('maybe use tool');
  });

  it('should create ToolCallStarted event', () => {
    const event = StreamingEvent.toolCallStarted('call_123', 'get_weather', 0);
    expect(event.event_type).toBe('ToolCallStarted');
    expect(event.tool_call_id).toBe('call_123');
    expect(event.tool_name).toBe('get_weather');
  });

  it('should create PartialToolCall event', () => {
    const event = StreamingEvent.partialToolCall('call_123', '{"location":', 0, false);
    expect(event.event_type).toBe('PartialToolCall');
    expect(event.arguments).toBe('{"location":');
    expect(event.is_complete).toBe(false);
  });

  it('should create ToolCallEnded event', () => {
    const event = StreamingEvent.toolCallEnded('call_123', 0);
    expect(event.event_type).toBe('ToolCallEnded');
    expect(event.tool_call_id).toBe('call_123');
  });

  it('should create Metadata event', () => {
    const usage = { prompt_tokens: 10, completion_tokens: 20 };
    const event = StreamingEvent.metadata(usage, 'stop', 'end_turn');
    expect(event.event_type).toBe('Metadata');
    expect(event.usage).toEqual(usage);
    expect(event.finish_reason).toBe('stop');
    expect(event.stop_reason).toBe('end_turn');
  });

  it('should create StreamEnd event', () => {
    const event = StreamingEvent.streamEnd('stop');
    expect(event.event_type).toBe('StreamEnd');
    expect(event.finish_reason).toBe('stop');
  });

  it('should create StreamError event', () => {
    const error = { message: 'Rate limited', code: 429 };
    const event = StreamingEvent.streamError(error, 'evt_001');
    expect(event.event_type).toBe('StreamError');
    expect(event.error).toEqual(error);
    expect(event.event_id).toBe('evt_001');
  });

  it('should create FinalCandidate event', () => {
    const event = StreamingEvent.finalCandidate(0, 'stop');
    expect(event.event_type).toBe('FinalCandidate');
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
