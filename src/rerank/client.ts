/**
 * Rerank client for document relevance scoring.
 * Aligned with ai-lib-python rerank/client.py
 */

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
  baseUrl?: string;
  endpointPath?: string;
  timeout?: number;
}

/**
 * Client for document reranking (e.g. Cohere Rerank)
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
    this.baseUrl = (config.baseUrl ?? 'https://api.cohere.com/v2').replace(/\/$/, '');
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

  /**
   * Rerank documents by relevance to query
   */
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

  build(): RerankerClient {
    const model = this._model;
    if (!model) throw new Error('Model must be specified');
    const apiKey = this._apiKey ?? (typeof process !== 'undefined' && process.env?.COHERE_API_KEY);
    if (!apiKey) throw new Error('API key required (COHERE_API_KEY)');
    return new RerankerClient({
      model,
      apiKey,
      baseUrl: this._baseUrl ?? undefined,
      endpointPath: this._endpointPath ?? undefined,
      timeout: this._timeout,
    });
  }
}
