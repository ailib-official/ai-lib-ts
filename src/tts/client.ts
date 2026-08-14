/**
 * TTS (Text-to-Speech) client.
 * HTTP via shared HttpTransport — [GOV-007].
 *
 * When built `fromManifest` and the model declares `text_to_speech`
 * (omit≠false), prefers `endpoints.text_to_speech` (PT-GEN / ALT-GEN-003).
 * Prefer `TextToSpeechClient` from `generative/` for new hosts.
 */

import type { ProtocolManifest, ProviderManifest } from '../protocol/manifest.js';
import { supportsGenerativeForModel } from '../protocol/manifest.js';
import { resolveCredential } from '../transport/credentials.js';
import { HttpTransport } from '../transport/http.js';
import {
  KEY_TEXT_TO_SPEECH,
} from '../generative/types.js';
import { requireGenerativeEndpoint } from '../generative/endpoints.js';

export type AudioFormat = 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';

export interface AudioOutput {
  data: ArrayBuffer;
  format: AudioFormat;
}

export interface TtsOptions {
  voice?: string;
  speed?: number;
  responseFormat?: AudioFormat | string;
}

export interface TtsClientConfig {
  model: string;
  transport: HttpTransport;
  endpointPath?: string;
}

function normalizeEndpointPath(path: string, fallback: string): string {
  const raw = path.trim() || fallback;
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('/')) {
    return raw;
  }
  return `/${raw}`;
}

function parseFormat(s: string | undefined): AudioFormat {
  const m: Record<string, AudioFormat> = {
    mp3: 'mp3',
    opus: 'opus',
    aac: 'aac',
    flac: 'flac',
    wav: 'wav',
    pcm: 'pcm',
  };
  return (s ? m[s.toLowerCase()] : undefined) ?? 'mp3';
}

function manifestBaseUrl(manifest: ProviderManifest): string | undefined {
  return manifest.endpoint?.base_url ?? manifest.base_url;
}

function asProtocol(manifest: ProviderManifest, modelId: string): ProtocolManifest {
  return { ...manifest, model_id: modelId } as ProtocolManifest;
}

/**
 * Client for text-to-speech synthesis (e.g. OpenAI TTS)
 */
export class TtsClient {
  private readonly model: string;
  readonly transport: HttpTransport;
  private readonly _endpointPath: string;

  constructor(config: TtsClientConfig) {
    this.model = config.model;
    this.transport = config.transport;
    this._endpointPath = normalizeEndpointPath(
      config.endpointPath ?? '',
      '/v1/audio/speech',
    );
  }

  static builder(): TtsClientBuilder {
    return new TtsClientBuilder();
  }

  get modelName(): string {
    return this.model;
  }

  /** Resolved request path (PT-GEN L-Exec or legacy default). */
  get endpointPath(): string {
    return this._endpointPath;
  }

  /**
   * Synthesize text to audio
   */
  async synthesize(text: string, options?: TtsOptions): Promise<AudioOutput> {
    const opts = options ?? {};
    const body: Record<string, string | number> = {
      model: this.model,
      input: text,
    };
    if (opts.voice) body.voice = opts.voice;
    if (opts.speed != null) body.speed = opts.speed;
    if (opts.responseFormat) body.response_format = opts.responseFormat;

    const response = await this.transport.post(this._endpointPath, body);
    const data = await response.arrayBuffer();
    const format = parseFormat(opts.responseFormat);
    return { data, format };
  }
}

export class TtsClientBuilder {
  private _model: string | null = null;
  private _apiKey: string | null = null;
  private _baseUrl: string | null = null;
  private _endpointPath: string | null = null;
  private _timeout = 60_000;
  private _manifest: ProviderManifest | null = null;

  model(m: string): this {
    this._model = m;
    return this;
  }

  apiKey(key: string | null): this {
    this._apiKey = key;
    return this;
  }

  baseUrl(url: string | null): this {
    this._baseUrl = url;
    return this;
  }

  endpointPath(path: string | null): this {
    this._endpointPath = path;
    return this;
  }

  timeout(ms: number): this {
    this._timeout = ms;
    return this;
  }

  fromManifest(manifest: ProviderManifest, modelId: string): this {
    const protocol = asProtocol(manifest, modelId);
    const resolved = resolveCredential(protocol, this._apiKey ?? undefined);
    if (!resolved.value) {
      const tried = [...resolved.requiredEnvVars, ...resolved.conventionalEnvVars];
      throw new Error(
        `API key required for TTS (provider=${manifest.id}; tried ${tried.join(', ')})`,
      );
    }
    this._apiKey = resolved.value;
    this._baseUrl = this._baseUrl ?? manifestBaseUrl(manifest) ?? null;
    this._model = modelId;
    this._manifest = manifest;
    return this;
  }

  build(): TtsClient {
    const model = this._model;
    if (!model) throw new Error('Model must be specified');
    const apiKey =
      this._apiKey ?? (typeof process !== 'undefined' && process.env?.OPENAI_API_KEY);
    if (!apiKey) throw new Error('API key required (OPENAI_API_KEY)');

    let endpointPath = this._endpointPath;
    if (endpointPath == null && this._manifest != null) {
      if (supportsGenerativeForModel(this._manifest, model, KEY_TEXT_TO_SPEECH)) {
        const ep = requireGenerativeEndpoint(this._manifest, model, KEY_TEXT_TO_SPEECH);
        endpointPath = ep.path;
      }
    }
    if (endpointPath == null) {
      endpointPath = '/v1/audio/speech';
    }

    const baseUrl = this._baseUrl ?? 'https://api.openai.com';
    const transport = this._manifest
      ? new HttpTransport(asProtocol(this._manifest, model), {
          baseUrlOverride: baseUrl,
          credential: apiKey,
          timeout: this._timeout,
        })
      : HttpTransport.withExplicitBearer({
          baseUrl,
          apiKey,
          timeout: this._timeout,
        });
    return new TtsClient({
      model,
      transport,
      endpointPath,
    });
  }
}
