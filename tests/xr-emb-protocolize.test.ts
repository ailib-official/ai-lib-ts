/**
 * XR-EMB contract: embeddings/rerank fail closed without silent vendor hosts.
 */
import { describe, expect, it } from 'vitest';
import {
  EmbeddingClient,
  embeddingsPathFromManifest,
} from '../src/embeddings/client.js';
import type { ProtocolManifest } from '../src/protocol/manifest.js';
import {
  RerankerClient,
  rerankPathFromManifest,
} from '../src/rerank/client.js';

function minimalManifest(
  overrides: Partial<ProtocolManifest> = {}
): ProtocolManifest {
  return {
    id: 'mock',
    protocol_version: '2.0',
    model_id: 'embed-1',
    endpoint: { base_url: 'https://example.test/v1' },
    auth: { type: 'bearer', token_env: 'MOCK_API_KEY' },
    ...overrides,
  };
}

describe('XR-EMB embeddings', () => {
  it('build() fails without baseUrl (no api.openai.com default)', () => {
    expect(() =>
      EmbeddingClient.builder().model('text-embedding-3-small').apiKey('k').build()
    ).toThrow(/baseUrl required|no vendor default/i);
  });

  it('build() fails without apiKey', () => {
    expect(() =>
      EmbeddingClient.builder()
        .model('m')
        .baseUrl('https://example.test')
        .build()
    ).toThrow(/API key required/i);
  });

  it('fromManifest sets path from endpoints.embeddings', () => {
    const m = minimalManifest({
      endpoints: { embeddings: { path: '/v1/embeddings' } },
    });
    expect(embeddingsPathFromManifest(m)).toBe('/v1/embeddings');
    const client = EmbeddingClient.builder()
      .apiKey('secret')
      .fromManifest(m, 'embed-1')
      .build();
    expect(client.modelName).toBe('embed-1');
    expect(client.transport.resolvedBaseUrl).toBe('https://example.test/v1');
  });

  it('explicit build wires HttpTransport', () => {
    const client = EmbeddingClient.builder()
      .model('emb')
      .apiKey('k')
      .baseUrl('https://example.test')
      .build();
    expect(client.transport.resolvedBaseUrl).toBe('https://example.test');
  });

  it('path fallback is /embeddings only', () => {
    expect(embeddingsPathFromManifest(minimalManifest())).toBe('/embeddings');
  });
});

describe('XR-EMB rerank', () => {
  it('build() fails without baseUrl (no api.cohere.com default)', () => {
    expect(() =>
      RerankerClient.builder().model('rerank-v3.5').apiKey('k').build()
    ).toThrow(/baseUrl required|no vendor default/i);
  });

  it('build() fails without apiKey', () => {
    expect(() =>
      RerankerClient.builder().model('m').baseUrl('https://example.test').build()
    ).toThrow(/API key required/i);
  });

  it('fromManifest sets path from endpoints.rerank', () => {
    const m = minimalManifest({
      endpoints: { rerank: { path: 'v2/rerank' } },
    });
    expect(rerankPathFromManifest(m)).toBe('/v2/rerank');
    const client = RerankerClient.builder()
      .apiKey('secret')
      .fromManifest(m, 'rerank-1')
      .build();
    expect(client.modelName).toBe('rerank-1');
    expect(client.transport.resolvedBaseUrl).toBe('https://example.test/v1');
  });

  it('path fallback is /rerank only', () => {
    expect(rerankPathFromManifest(minimalManifest())).toBe('/rerank');
  });
});
