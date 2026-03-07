/**
 * V2 Manifest loader.
 * Loads and parses V2 three-ring manifests.
 */

import { parse as parseYaml } from 'yaml';
import type { ManifestV2 } from './types.js';

/**
 * Load V2 manifest from JSON object
 */
export function parseManifestV2(data: unknown): ManifestV2 {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Manifest must be an object');
  }
  const obj = data as Record<string, unknown>;
  if (!obj.id || typeof obj.id !== 'string') {
    throw new Error('Manifest must have string "id"');
  }
  const normalized = { ...obj } as ManifestV2;
  if (!normalized.endpoints && normalized.endpoint) {
    normalized.endpoints = normalized.endpoint;
  }
  return normalized;
}

/**
 * Load V2 manifest from URL
 */
export async function loadManifestV2FromUrl(url: string): Promise<ManifestV2> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load manifest: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  return parseManifestV2(data);
}

/**
 * Load V2 manifest from local path (Node.js)
 */
export async function loadManifestV2FromPath(path: string): Promise<ManifestV2> {
  const { readFile } = await import('node:fs/promises');
  const content = await readFile(path, 'utf-8');
  const data = path.endsWith('.yaml') || path.endsWith('.yml') ? parseYaml(content) : JSON.parse(content);
  return parseManifestV2(data);
}
