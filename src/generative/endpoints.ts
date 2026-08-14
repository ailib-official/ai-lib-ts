/**
 * Resolve PT-GEN L-Exec maps from `endpoints.<key>`.
 *
 * 从 manifest endpoints.<key> 解析生成式路径；缺映射 fail-closed。
 */

import { AiLibError } from '../errors/index.js';
import {
  supportsGenerativeForModel,
  type EndpointConfig,
  type ProviderManifest,
} from '../protocol/manifest.js';
import {
  KEY_IMAGE_GENERATION,
  KEY_SPEECH_TO_TEXT,
  KEY_TEXT_TO_SPEECH,
} from './types.js';

const GENERATIVE_KEYS = [
  KEY_IMAGE_GENERATION,
  KEY_SPEECH_TO_TEXT,
  KEY_TEXT_TO_SPEECH,
] as const;

export type GenerativeCapabilityKey = (typeof GENERATIVE_KEYS)[number];

/** Adapter from L-Exec map; missing adapter defaults to openai (ALR-GEN-002). */
export function adapterName(endpoint: Pick<EndpointConfig, 'adapter'>): string {
  const raw = endpoint.adapter;
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim();
  }
  return 'openai';
}

/** Resolve `endpoints.<key>` (required for generative ops). */
export function resolveGenerativeEndpoint(
  manifest: ProviderManifest,
  key: string,
): EndpointConfig {
  if (!(GENERATIVE_KEYS as readonly string[]).includes(key)) {
    throw AiLibError.validation(
      `unknown generative capability \`${key}\`; expected one of ${GENERATIVE_KEYS.join(', ')}`,
    );
  }
  const ep = manifest.endpoints?.[key];
  if (!ep || typeof ep !== 'object') {
    throw AiLibError.validation(
      `manifest endpoints.${key} missing; declare PT-GEN-002 L-Exec map`,
    );
  }
  const path = ep.path;
  if (typeof path !== 'string' || !path.trim()) {
    throw AiLibError.validation(
      `manifest endpoints.${key} missing; declare PT-GEN-002 L-Exec map`,
    );
  }
  return ep;
}

/** Gate + resolve: capability must be known-true; endpoint must exist. */
export function requireGenerativeEndpoint(
  manifest: ProviderManifest,
  model: string,
  key: string,
): EndpointConfig {
  if (!supportsGenerativeForModel(manifest, model, key)) {
    throw AiLibError.validation(
      `model \`${model}\` does not declare model_capabilities.${key}=true ` +
        '(omit≠false fail-closed)',
    );
  }
  return resolveGenerativeEndpoint(manifest, key);
}
