/**
 * ALT-RSN-001: Thinking channel parity with ALR-RSN-001.
 */

import { describe, it, expect } from 'vitest';
import { createOpenAiEventMapper } from '../src/pipeline/index.js';
import { parseNonstreamChatResponse } from '../src/client/parseChatResponse.js';
import type { ProtocolManifest } from '../src/protocol/manifest.js';
import {
  thinkingFromOpenaiCompatDelta,
  thinkingFromOpenaiCompatMessage,
} from '../src/utils/thinkingExtract.js';

function manifest(partial: Partial<ProtocolManifest> & Pick<ProtocolManifest, 'id'>): ProtocolManifest {
  return {
    protocol_version: '2.0',
    model_id: 'm',
    ...partial,
  } as ProtocolManifest;
}

describe('thinkingExtract', () => {
  it('delta prefers reasoning_content', () => {
    const frame = {
      choices: [
        {
          delta: {
            reasoning_content: 'a',
            thinking: 'b',
            content: 'c',
          },
        },
      ],
    };
    expect(thinkingFromOpenaiCompatDelta(frame)).toBe('a');
  });

  it('delta alias thinking', () => {
    expect(thinkingFromOpenaiCompatDelta({ choices: [{ delta: { thinking: 'plan' } }] })).toBe(
      'plan'
    );
  });

  it('message reasoning not content', () => {
    expect(
      thinkingFromOpenaiCompatMessage({
        choices: [{ message: { content: '', reasoning_content: 'only think' } }],
      })
    ).toBe('only think');
  });
});

describe('OpenAI event mapper thinking aliases', () => {
  it('same frame emits thinking then content', () => {
    const mapper = createOpenAiEventMapper();
    const events = mapper.process({
      choices: [
        {
          index: 0,
          delta: { reasoning_content: 'plan', content: 'answer' },
        },
      ],
    });
    expect(events).toHaveLength(2);
    expect(events[0]?.event_type).toBe('ThinkingDelta');
    if (events[0]?.event_type === 'ThinkingDelta') {
      expect(events[0].thinking).toBe('plan');
    }
    expect(events[1]?.event_type).toBe('PartialContentDelta');
    if (events[1]?.event_type === 'PartialContentDelta') {
      expect(events[1].content).toBe('answer');
    }
  });

  it('alias thinking key', () => {
    const mapper = createOpenAiEventMapper();
    const events = mapper.process({
      choices: [{ delta: { thinking: 'via-alias' } }],
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.event_type).toBe('ThinkingDelta');
    if (events[0]?.event_type === 'ThinkingDelta') {
      expect(events[0].thinking).toBe('via-alias');
    }
  });
});

describe('non-stream thinking separation', () => {
  it('keeps thinking separate when content empty', () => {
    const r = parseNonstreamChatResponse(manifest({ id: 'openai' }), {
      choices: [
        {
          message: { content: '', reasoning_content: 'only think' },
          finish_reason: 'stop',
        },
      ],
    });
    expect(r.content).toBe('');
    expect(r.thinking).toBe('only think');
  });

  it('keeps both content and thinking', () => {
    const r = parseNonstreamChatResponse(manifest({ id: 'openai' }), {
      choices: [
        {
          message: { content: 'final', reasoning_content: 'scratch' },
          finish_reason: 'stop',
        },
      ],
    });
    expect(r.content).toBe('final');
    expect(r.thinking).toBe('scratch');
  });
});
