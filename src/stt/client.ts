/**
 * STT (Speech-to-Text) client.
 * HTTP via shared HttpTransport — [GOV-007].
 */

import { HttpTransport } from '../transport/http.js';

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
  readonly transport: HttpTransport;
  private readonly endpointPath: string;

  constructor(config: SttClientConfig) {
    this.model = config.model;
    this.transport = config.transport;
    this.endpointPath = config.endpointPath?.startsWith('/')
      ? config.endpointPath
      : `/${config.endpointPath ?? 'v1/audio/transcriptions'}`;
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
    const formData = new FormData();
    const blob = audio instanceof Blob ? audio : new Blob([audio], { type: 'audio/wav' });
    formData.append('file', blob, 'audio.wav');
    formData.append('model', this.model);

    if (opts.language) formData.append('language', opts.language);
    if (opts.prompt) formData.append('prompt', opts.prompt);
    if (opts.temperature != null) formData.append('temperature', String(opts.temperature));
    if (opts.responseFormat) formData.append('response_format', opts.responseFormat);

    const response = await this.transport.post(this.endpointPath, formData);
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
    const baseUrl = this._baseUrl ?? 'https://api.openai.com';
    const transport = HttpTransport.withExplicitBearer({
      baseUrl,
      apiKey,
      timeout: this._timeout,
    });
    return new SttClient({
      model,
      transport,
      endpointPath: this._endpointPath ?? undefined,
    });
  }
}
