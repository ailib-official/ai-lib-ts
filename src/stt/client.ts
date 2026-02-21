/**
 * STT (Speech-to-Text) client.
 * Aligned with ai-lib-python stt/client.py
 */

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
  apiKey: string;
  baseUrl?: string;
  endpointPath?: string;
  timeout?: number;
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

/**
 * Client for speech-to-text transcription (e.g. OpenAI Whisper)
 */
export class SttClient {
  private readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly endpointPath: string;
  private readonly timeout: number;

  constructor(config: SttClientConfig) {
    this.model = config.model;
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? 'https://api.openai.com').replace(/\/$/, '');
    this.endpointPath = config.endpointPath?.startsWith('/')
      ? config.endpointPath
      : `/${config.endpointPath ?? 'v1/audio/transcriptions'}`;
    this.timeout = config.timeout ?? 60_000;
  }

  static builder(): SttClientBuilder {
    return new SttClientBuilder();
  }

  get modelName(): string {
    return this.model;
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
    const endpoint = `${this.baseUrl}${this.endpointPath}`;

    const formData = new FormData();
    const blob = audio instanceof Blob ? audio : new Blob([audio], { type: 'audio/wav' });
    formData.append('file', blob, 'audio.wav');
    formData.append('model', this.model);

    if (opts.language) formData.append('language', opts.language);
    if (opts.prompt) formData.append('prompt', opts.prompt);
    if (opts.temperature != null) formData.append('temperature', String(opts.temperature));
    if (opts.responseFormat) formData.append('response_format', opts.responseFormat);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`STT request failed: ${response.status} ${errText}`);
      }

      const data = (await response.json()) as Record<string, unknown>;
      return fromOpenAIFormat(data);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export class SttClientBuilder {
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

  build(): SttClient {
    const model = this._model;
    if (!model) throw new Error('Model must be specified');
    const apiKey = this._apiKey ?? (typeof process !== 'undefined' && process.env?.OPENAI_API_KEY);
    if (!apiKey) throw new Error('API key required (OPENAI_API_KEY)');
    return new SttClient({
      model,
      apiKey,
      baseUrl: this._baseUrl ?? undefined,
      endpointPath: this._endpointPath ?? undefined,
      timeout: this._timeout,
    });
  }
}
