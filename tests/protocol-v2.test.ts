/**
 * Tests for Protocol V2
 */

import { describe, it, expect } from 'vitest';
import { Pipeline } from '../src/index.js';
import { parseManifestV2 } from '../src/index.js';
import { loadManifestV2FromPath } from '../src/index.js';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ProtocolLoader } from '../src/protocol/loader.js';
import { protocolRoot } from './helpers/protocol-root.js';

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

  it('preserves capability_profile fields', () => {
    const manifest = parseManifestV2({
      id: 'capability-profile-provider',
      protocol_version: '2.0',
      endpoint: { base_url: 'https://example.com' },
      capability_profile: {
        phase: 'ios_v1',
        inputs: { modalities: ['text'] },
      },
    });
    const cp = manifest.capability_profile as Record<string, unknown>;
    expect(cp.phase).toBe('ios_v1');
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
    expect(events[0]?.event_type).toBe('PartialContentDelta');
    if (events[0]?.event_type !== 'PartialContentDelta') {
      throw new Error('expected PartialContentDelta');
    }
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
    expect(events[0]?.event_type).toBe('PartialContentDelta');
    if (events[0]?.event_type !== 'PartialContentDelta') {
      throw new Error('expected PartialContentDelta');
    }
    expect(events[0].content).toBe('hi');
  });
});

describe('latest generative manifest consumption', () => {
  it('loads latest ai-protocol v2 provider manifests from yaml', async () => {
    const root = protocolRoot();

    const providers = [
      'openai',
      'anthropic',
      'google',
      'deepseek',
      'qwen',
      'doubao',
      'cohere',
      'moonshot',
      'zhipu',
      'jina',
    ];
    for (const provider of providers) {
      const manifest = await loadManifestV2FromPath(`${root}/v2/providers/${provider}.yaml`);
      expect(manifest.id).toBe(provider);
      const cp = (manifest.capability_profile ?? {}) as Record<string, unknown>;
      expect(cp.phase).toBe('ios_v1');
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

describe('ProtocolLoader v2 priority', () => {
  it('prefers dist/v2 provider manifest over dist/v1', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ai-lib-ts-loader-v2-'));
    try {
      const v2Dir = join(root, 'v2', 'providers');
      const v1Dir = join(root, 'v1', 'providers');
      await mkdir(v2Dir, { recursive: true });
      await mkdir(v1Dir, { recursive: true });
      await writeFile(
        join(v2Dir, 'openai.json'),
        JSON.stringify({
          id: 'openai',
          protocol_version: '2.0',
          endpoint: { base_url: 'https://v2.example.com' },
          capability_profile: { phase: 'ios_v1' },
        }),
        'utf-8'
      );
      await writeFile(
        join(v1Dir, 'openai.json'),
        JSON.stringify({
          id: 'openai',
          protocol_version: '1.5',
          endpoint: { base_url: 'https://v1.example.com' },
        }),
        'utf-8'
      );
      const loader = new ProtocolLoader({ protocolPath: root });
      const manifest = await loader.loadProvider('openai');
      expect(manifest.protocol_version).toBe('2.0');
      const baseUrl =
        manifest.base_url ??
        (manifest.endpoints as unknown as { base_url?: string } | undefined)?.base_url;
      expect(baseUrl).toBe('https://v2.example.com');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('falls back to dist/v1 when dist/v2 is missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ai-lib-ts-loader-v1-'));
    try {
      const v1Dir = join(root, 'v1', 'providers');
      await mkdir(v1Dir, { recursive: true });
      await writeFile(
        join(v1Dir, 'openai.json'),
        JSON.stringify({
          id: 'openai',
          protocol_version: '1.5',
          endpoint: { base_url: 'https://v1.example.com' },
        }),
        'utf-8'
      );
      const loader = new ProtocolLoader({ protocolPath: root });
      const manifest = await loader.loadProvider('openai');
      expect(manifest.protocol_version).toBe('1.5');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
