/**
 * Experimental STT / TTS via manifest L-Exec (ALT-GEN-002 / ALR-GEN-002).
 *
 * OpenAI adapter 形状；其他 adapter 显式失败。不替换 legacy stt/tts 模块。
 */

import { AiLibError } from '../errors/index.js';
import type { EndpointConfig, ProtocolManifest, ProviderManifest } from '../protocol/manifest.js';
import { resolveCredential } from '../transport/credentials.js';
import { HttpTransport } from '../transport/http.js';
import { adapterName, requireGenerativeEndpoint } from './endpoints.js';
import {
  KEY_SPEECH_TO_TEXT,
  KEY_TEXT_TO_SPEECH,
  type SpeechToTextRequest,
  type SpeechToTextResult,
  type TextToSpeechRequest,
  type TextToSpeechResult,
} from './types.js';

function requireOpenaiAdapter(ep: EndpointConfig, capability: string): string {
  const name = adapterName(ep);
  if (name !== 'openai') {
    throw AiLibError.validation(
      `${capability} adapter \`${name}\` not implemented in ALT-GEN-002 (openai only)`,
    );
  }
  return name;
}

function transportFor(
  manifest: ProviderManifest,
  model: string,
  capability: string,
): HttpTransport {
  const protocol = { ...manifest, model_id: model } as ProtocolManifest;
  const resolved = resolveCredential(protocol);
  if (!resolved.value) {
    const tried = [...resolved.requiredEnvVars, ...resolved.conventionalEnvVars];
    throw AiLibError.validation(
      `API key required for ${capability} (provider=${manifest.id}; tried ${tried.join(', ')})`,
    );
  }
  return new HttpTransport(protocol, { credential: resolved.value });
}

function audioBlob(audio: Uint8Array | string): Blob {
  if (typeof audio === 'string') {
    throw AiLibError.validation(
      'SpeechToTextRequest.audio string paths are not loaded in ALT-GEN-002; pass Uint8Array',
    );
  }
  // Copy into a fresh ArrayBuffer-backed view for DOM BlobPart typing.
  const copy = new Uint8Array(audio.byteLength);
  copy.set(audio);
  return new Blob([copy], { type: 'application/octet-stream' });
}

/** Experimental speech-to-text client (capability: `speech_to_text`). */
export class SpeechToTextClient {
  private readonly transport: HttpTransport;
  private readonly model: string;
  private readonly endpointPath: string;
  private readonly adapter: string;

  constructor(opts: {
    transport: HttpTransport;
    model: string;
    endpointPath: string;
    adapter: string;
  }) {
    this.transport = opts.transport;
    this.model = opts.model;
    this.endpointPath = opts.endpointPath;
    this.adapter = opts.adapter;
  }

  static fromManifest(manifest: ProviderManifest, model: string): SpeechToTextClient {
    const ep = requireGenerativeEndpoint(manifest, model, KEY_SPEECH_TO_TEXT);
    const adapter = requireOpenaiAdapter(ep, 'speech_to_text');
    return new SpeechToTextClient({
      transport: transportFor(manifest, model, 'speech_to_text'),
      model,
      endpointPath: ep.path,
      adapter,
    });
  }

  get endpoint_path(): string {
    return this.endpointPath;
  }

  get adapterName(): string {
    return this.adapter;
  }

  async transcribe(request: SpeechToTextRequest): Promise<SpeechToTextResult> {
    if (request.model !== this.model) {
      throw AiLibError.validation(
        `request model \`${request.model}\` != client model \`${this.model}\``,
      );
    }
    const form = new FormData();
    form.append('file', audioBlob(request.audio), 'audio.wav');
    form.append('model', this.model);
    if (request.language) form.append('language', request.language);
    if (request.response_format) form.append('response_format', request.response_format);
    const response = await this.transport.post(this.endpointPath, form);
    const payload = (await response.json()) as Record<string, unknown>;
    const text = typeof payload.text === 'string' ? payload.text : '';
    return { model: this.model, text };
  }
}

/** Experimental text-to-speech client (capability: `text_to_speech`). */
export class TextToSpeechClient {
  private readonly transport: HttpTransport;
  private readonly model: string;
  private readonly endpointPath: string;
  private readonly adapter: string;

  constructor(opts: {
    transport: HttpTransport;
    model: string;
    endpointPath: string;
    adapter: string;
  }) {
    this.transport = opts.transport;
    this.model = opts.model;
    this.endpointPath = opts.endpointPath;
    this.adapter = opts.adapter;
  }

  static fromManifest(manifest: ProviderManifest, model: string): TextToSpeechClient {
    const ep = requireGenerativeEndpoint(manifest, model, KEY_TEXT_TO_SPEECH);
    const adapter = requireOpenaiAdapter(ep, 'text_to_speech');
    return new TextToSpeechClient({
      transport: transportFor(manifest, model, 'text_to_speech'),
      model,
      endpointPath: ep.path,
      adapter,
    });
  }

  get endpoint_path(): string {
    return this.endpointPath;
  }

  get adapterName(): string {
    return this.adapter;
  }

  async synthesize(request: TextToSpeechRequest): Promise<TextToSpeechResult> {
    if (request.model !== this.model) {
      throw AiLibError.validation(
        `request model \`${request.model}\` != client model \`${this.model}\``,
      );
    }
    const body: Record<string, unknown> = { model: this.model, input: request.input };
    if (request.voice) body.voice = request.voice;
    if (request.response_format) body.response_format = request.response_format;
    const response = await this.transport.post(this.endpointPath, body);
    const buf = new Uint8Array(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') ?? undefined;
    return { model: this.model, audio: buf, content_type: contentType };
  }
}
