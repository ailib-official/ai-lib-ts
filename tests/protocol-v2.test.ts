/**
 * Tests for Protocol V2
 */

import { describe, it, expect } from 'vitest';
import { Pipeline } from '../src/index.js';
import { parseManifestV2 } from '../src/index.js';
import { loadManifestV2FromPath } from '../src/index.js';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

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

  it('normalizes endpoint and preserves structured shapes', () => {
    const manifest = parseManifestV2({
      id: 'shape-compat',
      protocol_version: '2.0',
      endpoint: {
        base_url: 'https://example.com',
        chat: { path: '/v2/chat', method: 'POST' },
      },
      streaming: {
        decoder: { format: 'sse', strategy: 'openai_chat' },
        event_map: [{ match: '$.choices[0]', emit: 'PartialContentDelta' }],
      },
      multimodal: {
        input: { video: { supported: true, formats: ['mp4'] } },
        output: { video: { supported: false } },
      },
    });
    expect(manifest.endpoints?.base_url).toBe('https://example.com');
    expect((manifest.endpoints?.chat as { path?: string }).path).toBe('/v2/chat');
    expect(((manifest.streaming as { decoder?: unknown }).decoder as { format?: string }).format).toBe(
      'sse'
    );
  });
});

describe('Pipeline.fromManifest', () => {
  it('creates OpenAI pipeline for openai provider', () => {
    const pipeline = Pipeline.fromManifest({
      id: 'openai',
      protocol_version: '1.0',
      model_id: 'gpt-4o',
    });
    const events = pipeline.process(
      'data: {"choices":[{"delta":{"content":"hi"},"index":0}]}\n\n'
    );
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe('PartialContentDelta');
    expect(events[0].content).toBe('hi');
  });

  it('creates Anthropic pipeline for anthropic provider', () => {
    const pipeline = Pipeline.fromManifest({
      id: 'anthropic',
      protocol_version: '1.0',
      model_id: 'claude-3-5-sonnet',
    });
    const events = pipeline.process(
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"hi"},"index":0}\n\n'
    );
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe('PartialContentDelta');
    expect(events[0].content).toBe('hi');
  });
});

describe('latest generative manifest consumption', () => {
  it('loads latest ai-protocol v2 provider manifests from yaml', async () => {
    const rootCandidates = [
      resolve(process.cwd(), '../ai-protocol'),
      resolve(process.cwd(), '../../ai-protocol'),
      'd:/ai-protocol',
    ];
    const protocolRoot = rootCandidates.find((candidate) => existsSync(candidate));
    expect(protocolRoot).toBeTruthy();

    const providers = ['google', 'deepseek', 'qwen', 'doubao'];
    for (const provider of providers) {
      const manifest = await loadManifestV2FromPath(
        `${protocolRoot}/v2/providers/${provider}.yaml`
      );
      expect(manifest.id).toBe(provider);
      const endpoint = manifest.endpoint ?? manifest.endpoints;
      expect(endpoint?.base_url).toBeTruthy();

      const multimodal = (manifest.multimodal ?? {}) as Record<string, unknown>;
      const input = (multimodal.input ?? {}) as Record<string, unknown>;
      const output = (multimodal.output ?? {}) as Record<string, unknown>;

      if (provider === 'google' || provider === 'qwen') {
        const videoIn = (input.video ?? {}) as Record<string, unknown>;
        expect(videoIn.supported).toBe(true);
      }

      const videoOut = (output.video ?? {}) as Record<string, unknown>;
      expect(videoOut.supported ?? false).toBe(false);
    }
  });
});
