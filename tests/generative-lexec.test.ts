/**
 * ALT-GEN-002: generative L-Exec gate + adapter bodies (omit ≠ false).
 */

import { describe, expect, it } from 'vitest';
import { AiLibError } from '../src/errors/index.js';
import type { ProviderManifest } from '../src/protocol/manifest.js';
import {
  KEY_IMAGE_GENERATION,
  KEY_SPEECH_TO_TEXT,
  dashscopeImageBody,
  openaiImageBody,
  requireGenerativeEndpoint,
  type ImageGenerationRequest,
} from '../src/generative/index.js';

function openaiFixture(): ProviderManifest {
  return {
    id: 'openai',
    protocol_version: '2.0',
    endpoint: {
      base_url: 'https://api.openai.com/v1',
      auth: { type: 'bearer', token_env: 'OPENAI_API_KEY' },
    },
    endpoints: {
      image_generation: {
        path: '/images/generations',
        method: 'POST',
        adapter: 'openai',
      },
      speech_to_text: {
        path: '/audio/transcriptions',
        method: 'POST',
        adapter: 'openai',
      },
    },
    metadata: {
      models: {
        'gpt-image-1': { model_capabilities: { image_generation: true } },
        'gpt-4o': { context_window: 128000 },
        'whisper-1': { model_capabilities: { speech_to_text: true } },
      },
    },
  };
}

function qwenFixture(): ProviderManifest {
  return {
    id: 'qwen',
    protocol_version: '2.0',
    endpoint: { base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
    endpoints: {
      image_generation: {
        path:
          'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
        method: 'POST',
        adapter: 'dashscope',
      },
    },
    metadata: {
      models: {
        'qwen-image-plus': { model_capabilities: { image_generation: true } },
      },
    },
  };
}

describe('requireGenerativeEndpoint (ALT-GEN-002)', () => {
  it('fail-closed when capability omitted', () => {
    const m = openaiFixture();
    expect(() => requireGenerativeEndpoint(m, 'gpt-4o', KEY_IMAGE_GENERATION)).toThrow(
      AiLibError,
    );
    try {
      requireGenerativeEndpoint(m, 'gpt-4o', KEY_IMAGE_GENERATION);
    } catch (e) {
      expect(String(e)).toMatch(/omit/);
    }
  });

  it('fail-closed when L-Exec map missing', () => {
    const m: ProviderManifest = {
      id: 'genprov',
      protocol_version: '2.0',
      endpoint: { base_url: 'https://example.com/v1' },
      metadata: {
        models: {
          'img-1': { model_capabilities: { image_generation: true } },
        },
      },
    };
    expect(() => requireGenerativeEndpoint(m, 'img-1', KEY_IMAGE_GENERATION)).toThrow(
      /endpoints\.image_generation/,
    );
  });

  it('resolves openai and qwen image endpoints', () => {
    const openai = openaiFixture();
    const ep = requireGenerativeEndpoint(openai, 'gpt-image-1', KEY_IMAGE_GENERATION);
    expect(ep.path).toBe('/images/generations');
    expect(ep.adapter).toBe('openai');

    const qwen = qwenFixture();
    const qep = requireGenerativeEndpoint(qwen, 'qwen-image-plus', KEY_IMAGE_GENERATION);
    expect(qep.path.startsWith('https://')).toBe(true);
    expect(qep.adapter).toBe('dashscope');

    expect(() =>
      requireGenerativeEndpoint(qwen, 'missing', KEY_IMAGE_GENERATION),
    ).toThrow(AiLibError);
  });

  it('resolves speech_to_text when declared', () => {
    const m = openaiFixture();
    const ep = requireGenerativeEndpoint(m, 'whisper-1', KEY_SPEECH_TO_TEXT);
    expect(ep.path).toBe('/audio/transcriptions');
  });
});

describe('image adapter bodies (ALT-GEN-002)', () => {
  it('openai and dashscope bodies differ', () => {
    const req: ImageGenerationRequest = { model: 'm', prompt: 'a cat' };
    const oai = openaiImageBody(req);
    const ds = dashscopeImageBody(req);
    expect(oai.prompt).toBe('a cat');
    expect(oai).not.toHaveProperty('input');
    expect(ds).not.toHaveProperty('prompt');
    const input = ds.input as {
      messages: Array<{ content: Array<{ text: string }> }>;
    };
    expect(input.messages[0].content[0].text).toBe('a cat');
  });
});
