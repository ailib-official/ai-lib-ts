/**
 * Protocol loader - loads protocol manifests from various sources
 */

import { parse as parseYaml } from 'yaml';
import type { ProviderManifest, ModelsManifest, ModelEntry, ProtocolManifest } from './manifest.js';
import { ProtocolError } from '../errors/index.js';

/**
 * Default protocol paths
 */
const DEFAULT_PROTOCOL_PATHS = [
  'node_modules/ai-protocol/dist',
  'node_modules/@hiddenpath/ai-protocol/dist',
  '../ai-protocol/dist',
  './protocols',
];

/**
 * GitHub raw URL base
 */
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/hiddenpath/ai-protocol/main';

/**
 * Protocol loader options
 */
export interface ProtocolLoaderOptions {
  protocolPath?: string;
  baseUrlOverride?: string;
  cache?: Map<string, ProtocolManifest>;
}

/**
 * Protocol loader class
 */
export class ProtocolLoader {
  private readonly options: ProtocolLoaderOptions;
  private readonly cache: Map<string, ProtocolManifest>;

  constructor(options: ProtocolLoaderOptions = {}) {
    this.options = options;
    this.cache = options.cache ?? new Map();
  }

  /**
   * Load a protocol manifest by provider/model string
   * @param modelString - Format: "provider/model-name" (e.g., "openai/gpt-4o")
   */
  async load(modelString: string): Promise<ProtocolManifest> {
    // Check cache first
    const cached = this.cache.get(modelString);
    if (cached) {
      return cached;
    }

    const [providerId, modelId] = this.parseModelString(modelString);

    // Load provider and model manifests
    const [provider, model] = await Promise.all([
      this.loadProvider(providerId),
      this.loadModel(providerId, modelId),
    ]);

    // Combine into protocol manifest
    const manifest: ProtocolManifest = {
      ...provider,
      model,
      model_id: model.model_id,
    };

    // Cache the result
    this.cache.set(modelString, manifest);

    return manifest;
  }

  /**
   * Parse provider/model string
   */
  private parseModelString(modelString: string): [string, string] {
    const parts = modelString.split('/');
    if (parts.length !== 2) {
      throw new ProtocolError(
        `Invalid model string format: "${modelString}". Expected "provider/model-name"`
      );
    }
    return [parts[0] ?? '', parts[1] ?? ''];
  }

  /**
   * Load a provider manifest
   */
  async loadProvider(providerId: string): Promise<ProviderManifest> {
    // Try local paths first
    for (const basePath of this.getProtocolPaths()) {
      try {
        const manifest = await this.loadFromPath(`${basePath}/providers/${providerId}.json`);
        if (manifest) {
          return manifest as ProviderManifest;
        }
      } catch {
        // Continue to next path
      }

      // Try YAML version
      try {
        const manifest = await this.loadFromPath(`${basePath}/../v1/providers/${providerId}.yaml`);
        if (manifest) {
          return manifest as ProviderManifest;
        }
      } catch {
        // Continue to next path
      }
    }

    // Try GitHub as fallback
    try {
      const manifest = await this.loadFromUrl(
        `${GITHUB_RAW_BASE}/dist/providers/${providerId}.json`
      );
      return manifest as ProviderManifest;
    } catch {
      throw new ProtocolError(`Failed to load provider manifest: ${providerId}`);
    }
  }

  /**
   * Load a model manifest entry
   */
  async loadModel(providerId: string, modelId: string): Promise<ModelEntry> {
    // Try local paths first
    for (const basePath of this.getProtocolPaths()) {
      try {
        const models = await this.loadFromPath(`${basePath}/models/${providerId}.json`);
        if (models && this.isModelsManifest(models)) {
          const model = models.models[modelId];
          if (model) {
            return model;
          }
        }
      } catch {
        // Continue to next path
      }

      // Try YAML version
      try {
        const models = await this.loadFromPath(`${basePath}/../v1/models/${providerId}.yaml`);
        if (models && this.isModelsManifest(models)) {
          const model = models.models[modelId];
          if (model) {
            return model;
          }
        }
      } catch {
        // Continue to next path
      }
    }

    // Try GitHub as fallback
    try {
      const models = await this.loadFromUrl(`${GITHUB_RAW_BASE}/dist/models/${providerId}.json`);
      if (models && this.isModelsManifest(models)) {
        const model = models.models[modelId];
        if (model) {
          return model;
        }
      }
    } catch {
      // Fall through to error
    }

    // Return a minimal model entry if not found
    return {
      provider: providerId,
      model_id: modelId,
    };
  }

  /**
   * Get protocol paths to search
   */
  private getProtocolPaths(): string[] {
    const paths = [...DEFAULT_PROTOCOL_PATHS];
    if (this.options.protocolPath) {
      paths.unshift(this.options.protocolPath);
    }
    return paths;
  }

  /**
   * Load manifest from local file path
   */
  private async loadFromPath(path: string): Promise<unknown | null> {
    try {
      // Use Node.js fs module dynamically
      const { readFile } = await import('node:fs/promises');
      const content = await readFile(path, 'utf-8');

      if (path.endsWith('.yaml') || path.endsWith('.yml')) {
        return parseYaml(content);
      }
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Load manifest from URL
   */
  private async loadFromUrl(url: string): Promise<unknown> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new ProtocolError(`Failed to fetch from ${url}: ${response.status}`);
    }

    const content = await response.text();

    if (url.endsWith('.yaml') || url.endsWith('.yml')) {
      return parseYaml(content);
    }
    return JSON.parse(content);
  }

  /**
   * Type guard for ModelsManifest
   */
  private isModelsManifest(obj: unknown): obj is ModelsManifest {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'models' in obj &&
      typeof (obj as ModelsManifest).models === 'object'
    );
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * List available providers (requires local ai-protocol)
   */
  async listProviders(): Promise<string[]> {
    for (const basePath of this.getProtocolPaths()) {
      try {
        const { readdir } = await import('node:fs/promises');
        const files = await readdir(`${basePath}/providers`);
        return files
          .filter((f) => f.endsWith('.json'))
          .map((f) => f.replace('.json', ''));
      } catch {
        // Continue to next path
      }
    }
    return [];
  }

  /**
   * List available models for a provider
   */
  async listModels(providerId: string): Promise<string[]> {
    for (const basePath of this.getProtocolPaths()) {
      try {
        const models = await this.loadFromPath(`${basePath}/models/${providerId}.json`);
        if (models && this.isModelsManifest(models)) {
          return Object.keys(models.models);
        }
      } catch {
        // Continue to next path
      }
    }
    return [];
  }
}

/**
 * Create a default protocol loader
 */
export function createLoader(options?: ProtocolLoaderOptions): ProtocolLoader {
  return new ProtocolLoader(options);
}
