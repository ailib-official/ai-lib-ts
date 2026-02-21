/**
 * Embedding types
 */

export interface Embedding {
  index: number;
  vector: number[];
  objectType?: string;
}

export interface EmbeddingUsage {
  promptTokens: number;
  totalTokens: number;
}

export interface EmbeddingResponse {
  embeddings: Embedding[];
  model: string;
  usage: EmbeddingUsage;
}
