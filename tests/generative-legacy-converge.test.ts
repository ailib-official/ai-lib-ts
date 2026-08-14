/**
 * ALT-GEN-003: legacy stt/tts prefer PT-GEN when declared.
 */

import { describe, expect, it } from 'vitest';
import type { ProviderManifest } from '../src/protocol/manifest.js';
import { SttClient } from '../src/stt/client.js';
import { TtsClient } from '../src/tts/client.js';

function audioManifest(opts: { stt?: boolean; tts?: boolean }): ProviderManifest {
  const models: Record<string, unknown> = {};
  const endpoints: Record<string, unknown> = {};
  const capabilities = ['text'];
  if (opts.stt !== false) {
    models['whisper-1'] = { model_capabilities: { speech_to_text: true } };
    endpoints.speech_to_text = {
      path: '/audio/transcriptions',
      method: 'POST',
      adapter: 'openai',
    };
    capabilities.push('speech_to_text');
  }
  if (opts.tts !== false) {
    models['tts-1'] = { model_capabilities: { text_to_speech: true } };
    endpoints.text_to_speech = {
      path: '/audio/speech',
      method: 'POST',
      adapter: 'openai',
    };
    capabilities.push('text_to_speech');
  }
  return {
    id: 'openai',
    protocol_version: '2.0',
    status: 'stable',
    endpoint: { base_url: 'https://api.openai.com/v1' },
    capabilities,
    endpoints,
    metadata: { models },
  } as ProviderManifest;
}

describe('ALT-GEN-003 legacy prefer PT-GEN', () => {
  it('stt fromManifest prefers speech_to_text path', () => {
    const m = audioManifest({ stt: true, tts: false });
    const client = SttClient.builder()
      .fromManifest(m, 'whisper-1')
      .apiKey('sk-test')
      .build();
    expect(client.endpointPath).toBe('/audio/transcriptions');
  });

  it('stt without PT-GEN keeps legacy default', () => {
    const m = {
      id: 'openai',
      protocol_version: '2.0',
      status: 'stable',
      endpoint: { base_url: 'https://api.openai.com/v1' },
      capabilities: ['text', 'stt'],
      metadata: { models: { 'whisper-1': { context_window: 1 } } },
    } as ProviderManifest;
    const client = SttClient.builder()
      .fromManifest(m, 'whisper-1')
      .apiKey('sk-test')
      .build();
    expect(client.endpointPath).toBe('/v1/audio/transcriptions');
  });

  it('stt explicit endpointPath overrides PT-GEN', () => {
    const m = audioManifest({ stt: true, tts: false });
    const client = SttClient.builder()
      .fromManifest(m, 'whisper-1')
      .apiKey('sk-test')
      .endpointPath('/custom/stt')
      .build();
    expect(client.endpointPath).toBe('/custom/stt');
  });

  it('tts fromManifest prefers text_to_speech path', () => {
    const m = audioManifest({ stt: false, tts: true });
    const client = TtsClient.builder()
      .fromManifest(m, 'tts-1')
      .apiKey('sk-test')
      .build();
    expect(client.endpointPath).toBe('/audio/speech');
  });
});
