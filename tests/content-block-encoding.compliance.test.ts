/**
 * Compliance tests for manifest-driven content block encoding (PT-079 / ALT-DOC-001).
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseAllDocuments } from 'yaml';
import { encodeBlocksForApiStyle } from '../src/types/manifest-encode.js';
import { protocolRoot } from './helpers/protocol-root.js';

type CaseDoc = {
  id: string;
  name: string;
  input: Record<string, unknown>;
  expected: Record<string, unknown>;
};

const CBE_CASE_IDS = new Set(['cbe-010', 'cbe-011', 'cbe-012']);

function complianceDir(): string {
  const envRoot = process.env.COMPLIANCE_DIR;
  if (envRoot && existsSync(envRoot)) {
    return envRoot;
  }
  return resolve(protocolRoot(), 'tests/compliance');
}

function loadContentBlockEncodeCases(): CaseDoc[] {
  const file = resolve(
    complianceDir(),
    'cases/11-content-block-encoding/document-encode.yaml',
  );
  const docs = parseAllDocuments(readFileSync(file, 'utf-8'));
  return docs
    .map((doc) => doc.toJSON() as CaseDoc | null)
    .filter(
      (data): data is CaseDoc =>
        Boolean(data && data.id && CBE_CASE_IDS.has(data.id) && data.input),
    );
}

function evalContentBlockEncode(c: CaseDoc): void {
  const apiStyle = String(c.input.api_style ?? '');
  const blocks = (c.input.blocks as Array<Record<string, unknown>>) ?? [];
  const expectError = Boolean(c.input.expect_error);

  if (expectError) {
    expect(() => encodeBlocksForApiStyle(apiStyle, blocks)).toThrow();
    return;
  }

  const encoded = encodeBlocksForApiStyle(apiStyle, blocks);
  expect(encoded).toEqual(c.expected.encoded);
}

describe('content block encoding compliance', () => {
  for (const c of loadContentBlockEncodeCases()) {
    it(`${c.id}: ${c.name}`, () => {
      const testType = c.input.type as string;
      if (testType === 'content_block_encode') {
        evalContentBlockEncode(c);
      }
    });
  }
});
