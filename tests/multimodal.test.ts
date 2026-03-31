/**
 * Tests for Multimodal module (STT, TTS, Rerank, ContentBlock extensions)
 */

import { describe, it, expect } from 'vitest';
import {
  SttClientBuilder,
  TtsClientBuilder,
  RerankerClientBuilder,
  ContentBlock,
} from '../src/index.ts';

describe('ContentBlock video and omni', () => {
  it('should create video block', () => {
    const block = ContentBlock.videoBase64('base64data', 'video/mp4');
    expect(block.type).toBe('video');
    if (block.type !== 'video') {
      throw new Error('expected video block');
    }
    expect(block.source.type).toBe('base64');
    expect(block.source.data).toBe('base64data');
  });

  it('should create omni block', () => {
    const block = ContentBlock.omni([
      { type: 'base64', data: 'img', media_type: 'image/png' },
      { type: 'url', data: 'https://example.com/audio.mp3' },
    ]);
    expect(block.type).toBe('omni');
    if (block.type !== 'omni') {
      throw new Error('expected omni block');
    }
    expect(block.sources).toHaveLength(2);
  });
});

describe('SttClientBuilder', () => {
  it('should require model', () => {
    expect(() => new SttClientBuilder().build()).toThrow('Model must be specified');
  });

  it('should require apiKey when not in env', () => {
    const orig = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      expect(() => new SttClientBuilder().model('whisper-1').build()).toThrow('API key required');
    } finally {
      if (orig !== undefined) process.env.OPENAI_API_KEY = orig;
    }
  });

  it('should build with explicit apiKey', () => {
    const client = new SttClientBuilder()
      .model('whisper-1')
      .apiKey('test-key')
      .build();
    expect(client.modelName).toBe('whisper-1');
  });
});

describe('TtsClientBuilder', () => {
  it('should require model and apiKey', () => {
    expect(() => new TtsClientBuilder().build()).toThrow('Model must be specified');
  });

  it('should build with explicit apiKey', () => {
    const client = new TtsClientBuilder()
      .model('tts-1')
      .apiKey('test-key')
      .build();
    expect(client.modelName).toBe('tts-1');
  });
});

describe('RerankerClientBuilder', () => {
  it('should require model and apiKey', () => {
    expect(() => new RerankerClientBuilder().build()).toThrow('Model must be specified');
  });

  it('should build with explicit apiKey', () => {
    const client = new RerankerClientBuilder()
      .model('rerank-v3')
      .apiKey('test-key')
      .build();
    expect(client.modelName).toBe('rerank-v3');
  });
});
