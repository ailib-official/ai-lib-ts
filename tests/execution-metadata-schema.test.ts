/**
 * ExecutionMetadata JSON shape vs ai-protocol v2 schema (PT-073f).
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import type { ExecutionMetadata } from '../src/types/execution-result.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadSchema(): object {
  const protocolRoot =
    process.env.AI_PROTOCOL_DIR ?? join(__dirname, '..', '..', 'ai-protocol');
  const raw = readFileSync(
    join(protocolRoot, 'schemas', 'v2', 'execution-metadata.json'),
    'utf8',
  );
  return JSON.parse(raw) as object;
}

function sampleMetadata(): ExecutionMetadata {
  return {
    provider_id: 'mock-anthropic',
    model_id: 'claude-test',
    execution_latency_ms: 12,
    translation_latency_ms: 3,
    micro_retry_count: 0,
    usage: {
      prompt_tokens: 10,
      completion_tokens: 4,
      total_tokens: 14,
      cache_read_tokens: 2,
    },
  };
}

describe('ExecutionMetadata schema alignment', () => {
  it('sample metadata validates against execution-metadata.json', () => {
    const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false });
    addFormats(ajv);
    const loaded = loadSchema() as Record<string, unknown>;
    const schema = { ...loaded };
    delete schema.$schema;
    const validate = ajv.compile(schema);
    const ok = validate(sampleMetadata());
    if (!ok) {
      expect(validate.errors).toEqual([]);
    }
    expect(ok).toBe(true);
  });
});
