/**
 * TTS (Text-to-Speech) client.
 * Aligned with ai-lib-python tts/client.py
 */

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
  apiKey: string;
  baseUrl?: string;
  endpointPath?: string;
  timeout?: number;
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
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly endpointPath: string;
  private readonly timeout: number;

  constructor(config: TtsClientConfig) {
    this.model = config.model;
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? 'https://api.openai.com').replace(/\/$/, '');
    this.endpointPath = config.endpointPath?.startsWith('/')
      ? config.endpointPath
      : `/${config.endpointPath ?? 'v1/audio/speech'}`;
    this.timeout = config.timeout ?? 60_000;
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
    const endpoint = `${this.baseUrl}${this.endpointPath}`;

    const body: Record<string, string | number> = {
      model: this.model,
      input: text,
    };
    if (opts.voice) body.voice = opts.voice;
    if (opts.speed != null) body.speed = opts.speed;
    if (opts.responseFormat) body.response_format = opts.responseFormat;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`TTS request failed: ${response.status} ${errText}`);
      }

      const data = await response.arrayBuffer();
      const format = parseFormat(opts.responseFormat);
      return { data, format };
    } finally {
      clearTimeout(timeoutId);
    }
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
    return new TtsClient({
      model,
      apiKey,
      baseUrl: this._baseUrl ?? undefined,
      endpointPath: this._endpointPath ?? undefined,
      timeout: this._timeout,
    });
  }
}
