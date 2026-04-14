/**
 * Non-streaming response parsing (manifest paths + OpenAI fallbacks).
 */

import { describe, it, expect } from 'vitest';
import { parseNonstreamChatResponse } from '../src/client/parseChatResponse.js';
import type { ProtocolManifest } from '../src/protocol/manifest.js';

function manifest(partial: Partial<ProtocolManifest> & Pick<ProtocolManifest, 'id'>): ProtocolManifest {
  return {
    protocol_version: '2.0',
    model_id: 'm',
    ...partial,
  } as ProtocolManifest;
}

describe('parseNonstreamChatResponse', () => {
  it('reads choices[0].message.content when no response_paths', () => {
    const m = manifest({ id: 'openai' });
    const raw = {
      choices: [{ message: { content: 'hello' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
    };
    const r = parseNonstreamChatResponse(m, raw);
    expect(r.content).toBe('hello');
    expect(r.finishReason).toBe('stop');
    expect(r.usage?.totalTokens).toBe(3);
  });

  it('prefers response_paths.content over choices message', () => {
    const m = manifest({
      id: 'custom',
      response_paths: { content: 'out.text', usage: 'u' },
    });
    const raw = {
      choices: [{ message: { content: 'ignored' }, finish_reason: 'stop' }],
      out: { text: 'from_path' },
      u: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 },
    };
    const r = parseNonstreamChatResponse(m, raw);
    expect(r.content).toBe('from_path');
    expect(r.usage?.promptTokens).toBe(5);
  });

  it('falls back to reasoning_content when primary content empty', () => {
    const m = manifest({ id: 'x' });
    const raw = {
      choices: [
        {
          message: { content: '', reasoning_content: 'think' },
          finish_reason: 'stop',
        },
      ],
    };
    const r = parseNonstreamChatResponse(m, raw);
    expect(r.content).toBe('think');
  });
});
