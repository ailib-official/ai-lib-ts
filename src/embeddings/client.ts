/**
 * Embedding client for generating embeddings.
 * XR-EMB / ARCH-001: base URL + path + credentials from manifest or explicit overrides —
 * no silent api.openai.com default.
 */

import type { ProtocolManifest } from '../protocol/manifest.js';
import { ProtocolLoader } from '../protocol/loader.js';
import { resolveCredential } from '../transport/credentials.js';
import type { Embedding, EmbeddingResponse } from './types.js';

export interface EmbeddingClientConfig {
  model: string;
  apiKey: string;
  baseUrl: string;
  endpointPath?: string;
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

/** Resolve embeddings path from manifest endpoints; else `/embeddings`. */
export function embeddingsPathFromManifest(manifest: ProtocolManifest): string {
  const ep = manifest.endpoints?.embeddings;
  if (ep?.path?.trim()) {
    return ep.path.startsWith('/') ? ep.path : `/${ep.path}`;
  }
  return '/embeddings';
}

function manifestBaseUrl(manifest: ProtocolManifest): string | undefined {
  return manifest.endpoint?.base_url ?? manifest.base_url;
}

export class EmbeddingClient {
  private readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly endpointPath: string;
  private readonly timeout: number;

  constructor(config: EmbeddingClientConfig) {
    this.model = config.model;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.endpointPath = config.endpointPath?.startsWith('/')
      ? config.endpointPath
      : `/${config.endpointPath ?? 'embeddings'}`;
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
    const endpoint = `${this.baseUrl}${this.endpointPath}`;
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
  private _endpointPath: string | null = null;
  private _timeout = 60_000;
  private _protocolPath: string | null = null;

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

  protocolPath(path: string): this {
    this._protocolPath = path;
    return this;
  }

  fromManifest(manifest: ProtocolManifest, modelId: string): this {
    const resolved = resolveCredential(manifest, this._apiKey ?? undefined);
    if (!resolved.value) {
      const tried = [...resolved.requiredEnvVars, ...resolved.conventionalEnvVars];
      throw new Error(
        `API key required for embeddings (provider=${manifest.id}; tried ${tried.join(', ')})`
      );
    }
    this._apiKey = resolved.value;
    this._baseUrl = this._baseUrl ?? manifestBaseUrl(manifest) ?? null;
    if (this._endpointPath == null) {
      this._endpointPath = embeddingsPathFromManifest(manifest);
    }
    this._model = modelId;
    return this;
  }

  async fromModel(model: string): Promise<EmbeddingClient> {
    const parts = model.split('/');
    if (parts.length < 2) {
      throw new Error('Model must be provider/model-id form');
    }
    const modelId = parts.slice(1).join('/');
    const loader = new ProtocolLoader(
      this._protocolPath ? { protocolPath: this._protocolPath } : {}
    );
    const manifest = await loader.load(model);
    return this.fromManifest(manifest, modelId).build();
  }

  build(): EmbeddingClient {
    const model = this._model;
    if (!model) throw new Error('Model must be specified');
    const apiKey = this._apiKey;
    if (!apiKey) {
      throw new Error(
        'API key required: use fromManifest/fromModel or set apiKey explicitly'
      );
    }
    const baseUrl = this._baseUrl;
    if (!baseUrl) {
      throw new Error(
        'baseUrl required: use fromManifest/fromModel or set baseUrl explicitly (no vendor default)'
      );
    }
    return new EmbeddingClient({
      model,
      apiKey,
      baseUrl,
      endpointPath: this._endpointPath ?? '/embeddings',
      timeout: this._timeout,
    });
  }
}
