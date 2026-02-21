/**
 * Tests for Protocol V2
 */

import { describe, it, expect } from 'vitest';
import { parseManifestV2 } from '../src/index.ts';

describe('parseManifestV2', () => {
  it('should parse minimal manifest', () => {
    const manifest = parseManifestV2({ id: 'openai' });
    expect(manifest.id).toBe('openai');
  });

  it('should parse full manifest', () => {
    const data = {
      id: 'openai',
      name: 'OpenAI',
      protocol_version: '2.0',
      auth: { type: 'bearer', token_env: 'OPENAI_API_KEY' },
      endpoints: { base_url: 'https://api.openai.com', chat: '/v1/chat/completions' },
      models: [{ id: 'gpt-4o', context_window: 128000 }],
    };
    const manifest = parseManifestV2(data);
    expect(manifest.id).toBe('openai');
    expect(manifest.endpoints?.base_url).toBe('https://api.openai.com');
    expect(manifest.models?.[0]?.id).toBe('gpt-4o');
  });

  it('should throw for invalid manifest', () => {
    expect(() => parseManifestV2(null)).toThrow('Manifest must be an object');
    expect(() => parseManifestV2({})).toThrow('Manifest must have string "id"');
  });
});
