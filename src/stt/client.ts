/**
 * STT (Speech-to-Text) client.
 * HTTP via shared HttpTransport — [GOV-007].
 *
 * When built `fromManifest` and the model declares `speech_to_text`
 * (omit≠false), prefers `endpoints.speech_to_text` (PT-GEN / ALT-GEN-003).
 * Prefer `SpeechToTextClient` from `generative/` for new hosts.
 */

import type { ProtocolManifest, ProviderManifest } from '../protocol/manifest.js';
import { supportsGenerativeForModel } from '../protocol/manifest.js';
import { resolveCredential } from '../transport/credentials.js';
import { HttpTransport } from '../transport/http.js';
import {
  KEY_SPEECH_TO_TEXT,
} from '../generative/types.js';
import { requireGenerativeEndpoint } from '../generative/endpoints.js';

export interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface Transcription {
  text: string;
  language?: string;
  confidence?: number;
  segments?: TranscriptionSegment[];
}

export interface SttOptions {
  language?: string;
  prompt?: string;
  temperature?: number;
  responseFormat?: string;
}

export interface SttClientConfig {
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

function fromOpenAIFormat(data: Record<string, unknown>): Transcription {
  const text = (data.text as string) ?? '';
  const language = data.language as string | undefined;
  const segmentsData = data.segments as Array<Record<string, unknown>> | undefined;
  const segments = segmentsData?.map((s) => ({
    id: (s.id as number) ?? 0,
    start: (s.start as number) ?? 0,
    end: (s.end as number) ?? 0,
    text: (s.text as string) ?? '',
  }));
  return { text, language, segments };
}

function manifestBaseUrl(manifest: ProviderManifest): string | undefined {
  return manifest.endpoint?.base_url ?? manifest.base_url;
}

function asProtocol(manifest: ProviderManifest, modelId: string): ProtocolManifest {
  return { ...manifest, model_id: modelId } as ProtocolManifest;
}

/**
 * Client for speech-to-text transcription (e.g. OpenAI Whisper)
 */
export class SttClient {
  private readonly model: string;
  readonly transport: HttpTransport;
  private readonly _endpointPath: string;

  constructor(config: SttClientConfig) {
    this.model = config.model;
    this.transport = config.transport;
    this._endpointPath = normalizeEndpointPath(
      config.endpointPath ?? '',
      '/v1/audio/transcriptions',
    );
  }

  static builder(): SttClientBuilder {
    return new SttClientBuilder();
  }

  get modelName(): string {
    return this.model;
  }

  /** Resolved request path (PT-GEN L-Exec or legacy default). */
  get endpointPath(): string {
    return this._endpointPath;
  }

  /**
   * Transcribe audio to text
   * @param audio - Raw audio bytes (ArrayBuffer, Blob, or Buffer)
   */
  async transcribe(
    audio: ArrayBuffer | Blob,
    options?: SttOptions
  ): Promise<Transcription> {
    const opts = options ?? {};
    const formData = new FormData();
    const blob = audio instanceof Blob ? audio : new Blob([audio], { type: 'audio/wav' });
    formData.append('file', blob, 'audio.wav');
    formData.append('model', this.model);

    if (opts.language) formData.append('language', opts.language);
    if (opts.prompt) formData.append('prompt', opts.prompt);
    if (opts.temperature != null) formData.append('temperature', String(opts.temperature));
    if (opts.responseFormat) formData.append('response_format', opts.responseFormat);

    const response = await this.transport.post(this._endpointPath, formData);
    const data = (await response.json()) as Record<string, unknown>;
    return fromOpenAIFormat(data);
  }
}

export class SttClientBuilder {
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
        `API key required for STT (provider=${manifest.id}; tried ${tried.join(', ')})`,
      );
    }
    this._apiKey = resolved.value;
    this._baseUrl = this._baseUrl ?? manifestBaseUrl(manifest) ?? null;
    this._model = modelId;
    this._manifest = manifest;
    return this;
  }

  build(): SttClient {
    const model = this._model;
    if (!model) throw new Error('Model must be specified');
    const apiKey =
      this._apiKey ?? (typeof process !== 'undefined' && process.env?.OPENAI_API_KEY);
    if (!apiKey) throw new Error('API key required (OPENAI_API_KEY)');

    let endpointPath = this._endpointPath;
    if (endpointPath == null && this._manifest != null) {
      if (supportsGenerativeForModel(this._manifest, model, KEY_SPEECH_TO_TEXT)) {
        const ep = requireGenerativeEndpoint(this._manifest, model, KEY_SPEECH_TO_TEXT);
        endpointPath = ep.path;
      }
    }
    if (endpointPath == null) {
      endpointPath = '/v1/audio/transcriptions';
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
    return new SttClient({
      model,
      transport,
      endpointPath,
    });
  }
}
