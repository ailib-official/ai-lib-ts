/**
 * Embedded ProviderContract YAML (synced from ai-protocol v2/contracts).
 *
 * 嵌入的 ProviderContract 真源；合规测试与 manifest encoder 共用。
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { parseProviderContract, type ProviderContract } from './provider-contract.js';

const _HERE = dirname(fileURLToPath(import.meta.url));

function resolveEmbeddedDir(): string {
  const candidates = [
    join(_HERE, 'embedded'),
    join(_HERE, '..', '..', '..', 'src', 'protocol', 'v2', 'embedded'),
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, 'anthropic-messages.contract.yaml'))) {
      return dir;
    }
  }
  throw new Error('embedded ProviderContract directory not found');
}

function loadYamlContract(name: string): ProviderContract {
  const path = join(resolveEmbeddedDir(), name);
  const raw = parseYaml(readFileSync(path, 'utf-8'));
  return parseProviderContract(raw);
}

/** Load embedded Anthropic Messages contract. */
export function anthropicMessagesContract(): ProviderContract {
  return loadYamlContract('anthropic-messages.contract.yaml');
}

/** Load embedded Gemini generateContent contract. */
export function geminiGenerateContract(): ProviderContract {
  return loadYamlContract('gemini-generate.contract.yaml');
}

/** Resolve embedded contract for a driver API style. */
export function contractForApiStyle(apiStyle: string): ProviderContract {
  if (apiStyle === 'anthropic_messages') {
    return anthropicMessagesContract();
  }
  if (apiStyle === 'gemini_generate') {
    return geminiGenerateContract();
  }
  throw new Error(`no embedded ProviderContract for api_style ${apiStyle}`);
}
