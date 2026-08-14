/**
 * ALT-GEN-001: generative capability gate (omit ≠ false).
 */

import { describe, expect, it } from 'vitest';
import {
  supportsGenerativeForModel,
  type ProviderManifest,
} from '../src/protocol/manifest.js';
import {
  KEY_IMAGE_GENERATION,
  KEY_SPEECH_TO_TEXT,
} from '../src/generative/types.js';

function openaiFixture(): ProviderManifest {
  return {
    id: 'openai',
    protocol_version: '2.0',
    endpoint: { base_url: 'https://api.openai.com/v1' },
    endpoints: {
      image_generation: { path: '/images/generations', method: 'POST' },
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

describe('supportsGenerativeForModel (ALT-GEN-001)', () => {
  it('returns true when model_capabilities.key is true', () => {
    const m = openaiFixture();
    expect(supportsGenerativeForModel(m, 'gpt-image-1', KEY_IMAGE_GENERATION)).toBe(true);
    expect(supportsGenerativeForModel(m, 'whisper-1', KEY_SPEECH_TO_TEXT)).toBe(true);
  });

  it('returns false when key is omitted (omit ≠ false)', () => {
    const m = openaiFixture();
    expect(supportsGenerativeForModel(m, 'gpt-4o', KEY_IMAGE_GENERATION)).toBe(false);
    expect(supportsGenerativeForModel(m, 'gpt-image-1', KEY_SPEECH_TO_TEXT)).toBe(false);
  });

  it('returns false for unknown model id', () => {
    const m = openaiFixture();
    expect(supportsGenerativeForModel(m, 'missing', KEY_IMAGE_GENERATION)).toBe(false);
  });

  it('returns false when model_capabilities.key is explicitly false', () => {
    const m: ProviderManifest = {
      id: 'x',
      protocol_version: '2.0',
      metadata: {
        models: {
          m1: { model_capabilities: { image_generation: false } },
        },
      },
    };
    expect(supportsGenerativeForModel(m, 'm1', KEY_IMAGE_GENERATION)).toBe(false);
  });
});
