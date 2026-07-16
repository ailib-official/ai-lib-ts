/**
 * Protocol loader - loads protocol manifests from various sources
 */

import { parse as parseYaml } from 'yaml';
import type { ProviderManifest, ModelsManifest, ModelEntry, ProtocolManifest } from './manifest.js';
import { ProtocolError } from '../errors/index.js';

/**
 * Default protocol roots / package surfaces.
 * Prefer repository roots so ``dist/`` can be resolved; keep legacy dist/v2 entries.
 */
const DEFAULT_PROTOCOL_PATHS = [
  '../ai-protocol',
  '../../ai-protocol',
  'node_modules/ai-protocol',
  'node_modules/@ailib-official/ai-protocol',
  // Legacy: already pointing at published dist trees
  'node_modules/ai-protocol/dist/v2',
  'node_modules/@ailib-official/ai-protocol/dist/v2',
  '../ai-protocol/dist/v2',
  '../ai-protocol/v2',
  'node_modules/ai-protocol/dist/v1',
  'node_modules/@ailib-official/ai-protocol/dist/v1',
  '../ai-protocol/dist/v1',
  './protocols',
];

/**
 * GitHub raw URL base
 */
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/ailib-official/ai-protocol/main';

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
   * Load a provider manifest.
   *
   * Resolution (PT-ARCH-005 / ALT-ID-001):
   * 1. Exact match on authoritative roots via published ``dist/``
   * 2. If missing: alias → canonical via ``dist/provider-identity.json``
   * 3. Retry exact on authoritative roots
   * 4. Elegant degrade: packaged node_modules / relative defaults, then GitHub dist
   * 5. Else fail closed
   */
  async loadProvider(providerId: string): Promise<ProviderManifest> {
    const { authoritative, degrade } = this.getProtocolRootTiers();

    const exactPrimary = await this.loadProviderExactFromRoots(providerId, authoritative);
    if (exactPrimary) {
      return exactPrimary;
    }

    const canonical = await this.resolveCanonicalProviderId(providerId, [
      ...authoritative,
      ...degrade,
    ]);
    if (canonical && canonical !== providerId) {
      const resolved = await this.loadProviderExactFromRoots(canonical, authoritative);
      if (resolved) {
        return resolved;
      }
      const resolvedDegrade = await this.loadProviderExactFromRoots(canonical, degrade);
      if (resolvedDegrade) {
        return resolvedDegrade;
      }
    }

    const exactDegrade = await this.loadProviderExactFromRoots(providerId, degrade);
    if (exactDegrade) {
      return exactDegrade;
    }

    const remote = await this.loadProviderFromGithubDist(providerId);
    if (remote) {
      return remote;
    }
    if (canonical && canonical !== providerId) {
      const remoteCanonical = await this.loadProviderFromGithubDist(canonical);
      if (remoteCanonical) {
        return remoteCanonical;
      }
    }

    throw new ProtocolError(
      `Failed to load provider manifest: ${providerId} (checked dist/ then source; alias map if present)`
    );
  }

  private providerPathCandidates(basePath: string, providerId: string): string[] {
    return [
      // Primary: published package surface
      `${basePath}/dist/v2/providers/${providerId}.json`,
      `${basePath}/dist/v1/providers/${providerId}.json`,
      // When basePath already is dist/v2 or dist/v1
      `${basePath}/providers/${providerId}.json`,
      // Graceful degrade: source / unbuilt checkout
      `${basePath}/v2/providers/${providerId}.json`,
      `${basePath}/v2/providers/${providerId}.yaml`,
      `${basePath}/v1/providers/${providerId}.json`,
      `${basePath}/v1/providers/${providerId}.yaml`,
      `${basePath}/providers/${providerId}.yaml`,
    ];
  }

  private async loadProviderExactFromRoots(
    providerId: string,
    roots: string[]
  ): Promise<ProviderManifest | null> {
    for (const basePath of roots) {
      for (const path of this.providerPathCandidates(basePath, providerId)) {
        const manifest = await this.loadFromPath(path);
        if (manifest) {
          return this.normalizeProviderManifest(manifest);
        }
      }
    }
    return null;
  }

  private async loadProviderFromGithubDist(
    providerId: string
  ): Promise<ProviderManifest | null> {
    for (const remote of [
      `${GITHUB_RAW_BASE}/dist/v2/providers/${providerId}.json`,
      `${GITHUB_RAW_BASE}/dist/v1/providers/${providerId}.json`,
    ]) {
      try {
        const manifest = await this.loadFromUrl(remote);
        return this.normalizeProviderManifest(manifest);
      } catch {
        // try next remote
      }
    }
    return null;
  }

  private identityMapCandidates(roots: string[]): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const root of roots) {
      for (const candidate of [
        `${root}/dist/provider-identity.json`,
        `${root}/provider-identity.json`,
        `${root}/v2/provider-identity.fixture.json`,
        `${root}/../provider-identity.json`,
        `${root}/../dist/provider-identity.json`,
      ]) {
        if (!seen.has(candidate)) {
          seen.add(candidate);
          out.push(candidate);
        }
      }
    }
    return out;
  }

  private canonicalFromFamily(
    family: Record<string, unknown>,
    key: string
  ): string | undefined {
    const canonical = family.canonical_id;
    if (typeof canonical !== 'string') {
      return undefined;
    }
    if (key === canonical) {
      return canonical;
    }
    const aliases = family.aliases;
    if (Array.isArray(aliases) && aliases.some((a) => a === key)) {
      return canonical;
    }
    return undefined;
  }

  private canonicalFromIdentityValue(value: unknown, key: string): string | undefined {
    if (!value || typeof value !== 'object') {
      return undefined;
    }
    const obj = value as Record<string, unknown>;
    const families = obj.families;
    if (Array.isArray(families)) {
      for (const family of families) {
        if (family && typeof family === 'object') {
          const canonical = this.canonicalFromFamily(family as Record<string, unknown>, key);
          if (canonical) {
            return canonical;
          }
        }
      }
      return undefined;
    }
    return this.canonicalFromFamily(obj, key);
  }

  private async resolveCanonicalProviderId(
    key: string,
    roots: string[]
  ): Promise<string | undefined> {
    for (const mapPath of this.identityMapCandidates(roots)) {
      const raw = await this.loadFromPath(mapPath);
      if (!raw) {
        continue;
      }
      const canonical = this.canonicalFromIdentityValue(raw, key);
      if (canonical) {
        return canonical;
      }
    }
    return undefined;
  }

  private normalizeProviderManifest(manifest: unknown): ProviderManifest {
    const normalized = ({ ...(manifest as Record<string, unknown>) } as unknown) as ProviderManifest & {
      endpoint?: { base_url?: string };
    };
    if (!normalized.base_url && normalized.endpoint?.base_url) {
      normalized.base_url = normalized.endpoint.base_url;
    }
    return normalized;
  }

  /**
   * Load a model manifest entry
   */
  async loadModel(providerId: string, modelId: string): Promise<ModelEntry> {
    // Try local paths first
    for (const basePath of this.getProtocolPaths()) {
      const candidates = [
        `${basePath}/models/${providerId}.json`,
        `${basePath}/v1/models/${providerId}.json`,
        `${basePath}/models/${providerId}.yaml`,
        `${basePath}/v1/models/${providerId}.yaml`,
      ];
      for (const path of candidates) {
        const models = await this.loadFromPath(path);
        if (models && this.isModelsManifest(models)) {
          const model = models.models[modelId];
          if (model) {
            return model;
          }
        }
      }
    }

    // Try GitHub as fallback
    try {
      const models = await this.loadFromUrl(
        `${GITHUB_RAW_BASE}/dist/v1/models/${providerId}.json`
      );
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
   * Get protocol paths to search (flat list for listProviders / models).
   */
  private getProtocolPaths(): string[] {
    const { authoritative, degrade } = this.getProtocolRootTiers();
    return [...authoritative, ...degrade];
  }

  /**
   * Authoritative roots (explicit path / AI_PROTOCOL_DIR) vs packaged degrade.
   * Stale node_modules must not shadow tip alias resolution.
   */
  private getProtocolRootTiers(): { authoritative: string[]; degrade: string[] } {
    if (this.options.protocolPath) {
      return { authoritative: [this.options.protocolPath], degrade: [] };
    }
    const envPath = process.env.AI_PROTOCOL_PATH ?? process.env.AI_PROTOCOL_DIR;
    if (envPath) {
      return { authoritative: [envPath], degrade: [...DEFAULT_PROTOCOL_PATHS] };
    }
    return { authoritative: [], degrade: [...DEFAULT_PROTOCOL_PATHS] };
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
