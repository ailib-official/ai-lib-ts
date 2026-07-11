/**
 * Rerank client for document relevance scoring.
 * XR-EMB / ARCH-001: base URL + path + credentials from manifest or explicit overrides —
 * no silent api.cohere.com default.
 */

import type { ProtocolManifest } from '../protocol/manifest.js';
import { ProtocolLoader } from '../protocol/loader.js';
import { resolveCredential } from '../transport/credentials.js';

export interface RerankResult {
  index: number;
  relevanceScore: number;
  document?: string;
}

export interface RerankOptions {
  topN?: number;
  maxTokensPerDoc?: number;
}

export interface RerankerClientConfig {
  model: string;
  apiKey: string;
  baseUrl: string;
  endpointPath?: string;
  timeout?: number;
}

/** Resolve rerank path from manifest endpoints; else `/rerank`. */
export function rerankPathFromManifest(manifest: ProtocolManifest): string {
  const ep = manifest.endpoints?.rerank;
  if (ep?.path?.trim()) {
    return ep.path.startsWith('/') ? ep.path : `/${ep.path}`;
  }
  return '/rerank';
}

function manifestBaseUrl(manifest: ProtocolManifest): string | undefined {
  return manifest.endpoint?.base_url ?? manifest.base_url;
}

/**
 * Client for document reranking (manifest- or explicitly configured).
 */
export class RerankerClient {
  private readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly endpointPath: string;
  private readonly timeout: number;

  constructor(config: RerankerClientConfig) {
    this.model = config.model;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.endpointPath = config.endpointPath?.startsWith('/')
      ? config.endpointPath
      : `/${config.endpointPath ?? 'rerank'}`;
    this.timeout = config.timeout ?? 60_000;
  }

  static builder(): RerankerClientBuilder {
    return new RerankerClientBuilder();
  }

  get modelName(): string {
    return this.model;
  }

  async rerank(
    query: string,
    documents: string[],
    options?: RerankOptions
  ): Promise<RerankResult[]> {
    const opts = options ?? {};
    const endpoint = `${this.baseUrl}${this.endpointPath}`;

    const body: Record<string, unknown> = {
      model: this.model,
      query,
      documents,
    };
    if (opts.topN != null) body.top_n = opts.topN;
    if (opts.maxTokensPerDoc != null) body.max_tokens_per_doc = opts.maxTokensPerDoc;

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
        throw new Error(`Rerank request failed: ${response.status} ${errText}`);
      }

      const data = (await response.json()) as { results?: Array<Record<string, unknown>> };
      const results = data.results ?? [];
      return results.map((r) => ({
        index: (r.index as number) ?? 0,
        relevanceScore: Number(r.relevance_score ?? 0),
        document: r.document as string | undefined,
      }));
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export class RerankerClientBuilder {
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
        `API key required for rerank (provider=${manifest.id}; tried ${tried.join(', ')})`
      );
    }
    this._apiKey = resolved.value;
    this._baseUrl = this._baseUrl ?? manifestBaseUrl(manifest) ?? null;
    if (this._endpointPath == null) {
      this._endpointPath = rerankPathFromManifest(manifest);
    }
    this._model = modelId;
    return this;
  }

  async fromModel(model: string): Promise<RerankerClient> {
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

  build(): RerankerClient {
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
    return new RerankerClient({
      model,
      apiKey,
      baseUrl,
      endpointPath: this._endpointPath ?? '/rerank',
      timeout: this._timeout,
    });
  }
}
