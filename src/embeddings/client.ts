/**
 * Embedding client for generating embeddings.
 */

import type { Embedding, EmbeddingResponse } from './types.js';

export interface EmbeddingClientConfig {
  model: string;
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

function fromOpenAIFormat(data: Record<string, unknown>): EmbeddingResponse {
  const dataArr = (data.data as Array<Record<string, unknown>>) ?? [];
  const embeddings: Embedding[] = dataArr.map((e, i) => ({
    index: (e.index as number) ?? i,
    vector: (e.embedding as number[]) ?? [],
    objectType: (e.object as string) ?? 'embedding',
  }));
  const usage = (data.usage as Record<string, number>) ?? {};
  return {
    embeddings,
    model: (data.model as string) ?? '',
    usage: {
      promptTokens: usage.prompt_tokens ?? 0,
      totalTokens: usage.total_tokens ?? 0,
    },
  };
}

export class EmbeddingClient {
  private readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(config: EmbeddingClientConfig) {
    this.model = config.model;
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? 'https://api.openai.com').replace(/\/$/, '');
    this.timeout = config.timeout ?? 60_000;
  }

  static builder(): EmbeddingClientBuilder {
    return new EmbeddingClientBuilder();
  }

  get modelName(): string {
    return this.model;
  }

  async embed(text: string, dimensions?: number): Promise<EmbeddingResponse> {
    return this.embedBatch([text], dimensions);
  }

  async embedBatch(
    texts: string[],
    dimensions?: number,
    batchSize = 100
  ): Promise<EmbeddingResponse> {
    if (texts.length <= batchSize) {
      return this._execute(texts, dimensions);
    }
    const allEmbeddings: Embedding[] = [];
    let totalPrompt = 0;
    let totalTokens = 0;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const resp = await this._execute(batch, dimensions);
      for (const e of resp.embeddings) {
        allEmbeddings.push({ ...e, index: i + e.index });
      }
      totalPrompt += resp.usage.promptTokens;
      totalTokens += resp.usage.totalTokens;
    }
    return {
      embeddings: allEmbeddings,
      model: this.model,
      usage: { promptTokens: totalPrompt, totalTokens },
    };
  }

  private async _execute(
    input: string[],
    dimensions?: number
  ): Promise<EmbeddingResponse> {
    const endpoint = `${this.baseUrl}/v1/embeddings`;
    const body: Record<string, unknown> = {
      model: this.model,
      input: input.length === 1 ? input[0] : input,
    };
    if (dimensions != null) body.dimensions = dimensions;
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
        throw new Error(`Embedding request failed: ${response.status} ${errText}`);
      }
      const data = (await response.json()) as Record<string, unknown>;
      return fromOpenAIFormat(data);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export class EmbeddingClientBuilder {
  private _model: string | null = null;
  private _apiKey: string | null = null;
  private _baseUrl: string | null = null;
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

  timeout(ms: number): this {
    this._timeout = ms;
    return this;
  }

  build(): EmbeddingClient {
    const model = this._model;
    if (!model) throw new Error('Model must be specified');
    const apiKey = this._apiKey ?? (typeof process !== 'undefined' && process.env?.OPENAI_API_KEY);
    if (!apiKey) throw new Error('API key required (OPENAI_API_KEY)');
    return new EmbeddingClient({ model, apiKey, baseUrl: this._baseUrl ?? undefined, timeout: this._timeout });
  }
}
