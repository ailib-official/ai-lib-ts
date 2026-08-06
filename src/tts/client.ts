/**
 * TTS (Text-to-Speech) client.
 * HTTP via shared HttpTransport — [GOV-007].
 */

import { HttpTransport } from '../transport/http.js';

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

/**
 * Client for text-to-speech synthesis (e.g. OpenAI TTS)
 */
export class TtsClient {
  private readonly model: string;
  readonly transport: HttpTransport;
  private readonly endpointPath: string;

  constructor(config: TtsClientConfig) {
    this.model = config.model;
    this.transport = config.transport;
    this.endpointPath = config.endpointPath?.startsWith('/')
      ? config.endpointPath
      : `/${config.endpointPath ?? 'v1/audio/speech'}`;
  }

  static builder(): TtsClientBuilder {
    return new TtsClientBuilder();
  }

  get modelName(): string {
    return this.model;
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

    const response = await this.transport.post(this.endpointPath, body);
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

  build(): TtsClient {
    const model = this._model;
    if (!model) throw new Error('Model must be specified');
    const apiKey = this._apiKey ?? (typeof process !== 'undefined' && process.env?.OPENAI_API_KEY);
    if (!apiKey) throw new Error('API key required (OPENAI_API_KEY)');
    const baseUrl = this._baseUrl ?? 'https://api.openai.com';
    const transport = HttpTransport.withExplicitBearer({
      baseUrl,
      apiKey,
      timeout: this._timeout,
    });
    return new TtsClient({
      model,
      transport,
      endpointPath: this._endpointPath ?? undefined,
    });
  }
}
