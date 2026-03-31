/**
 * Compliance tests for advanced capabilities matrix.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse, parseAllDocuments } from 'yaml';
import { protocolRoot } from './helpers/protocol-root.js';

type CaseDoc = {
  id: string;
  name: string;
  input: Record<string, unknown>;
  expected: Record<string, unknown>;
};

function loadCases(relPath: string): CaseDoc[] {
  const root = protocolRoot();
  const file = resolve(root, relPath);
  const docs = parseAllDocuments(readFileSync(file, 'utf-8'));
  return docs
    .map((doc) => doc.toJSON() as CaseDoc | null)
    .filter((data): data is CaseDoc => Boolean(data && data.id && data.input));
}

function evalCapabilityGuard(c: CaseDoc): void {
  const method = String(c.input.method ?? '');
  const manifest = parse(String(c.input.manifest ?? '')) as Record<string, unknown>;
  const keyMap: Record<string, string> = {
    MCPListTools: 'mcp',
    ComputerUse: 'computer_use',
    Reason: 'reasoning',
    VideoGenerate: 'video',
  };
  const capKey = keyMap[method] ?? '';
  const caps = manifest.capabilities;
  let hasCap = false;
  if (Array.isArray(caps)) {
    hasCap = caps.includes(capKey);
  } else if (caps && typeof caps === 'object') {
    hasCap = capKey in (caps as Record<string, unknown>);
  }
  const actualCode = hasCap ? '' : 'E1005';
  expect(actualCode).toBe(String(c.expected.error_code ?? ''));
}

function evalAdvancedEndpointMapping(c: CaseDoc): void {
  const operation = String(c.input.operation ?? '');
  const fallback = String(c.input.fallback ?? '');
  const manifest = parse(String(c.input.manifest ?? '')) as Record<string, unknown>;
  const endpoints = (((manifest.core as Record<string, unknown>)?.endpoint as Record<string, unknown>)
    ?.endpoints ?? {}) as Record<string, Record<string, unknown>>;
  const op = endpoints[operation] ?? {};
  const path = String(op.path ?? fallback);
  const method = String(op.method ?? 'POST').toUpperCase();
  expect(path).toBe(String(c.expected.path ?? ''));
  expect(method).toBe(String(c.expected.method ?? ''));
}

function evalFallbackDecision(c: CaseDoc): void {
  const code = String(c.input.error_code ?? '');
  const shouldFallback = new Set(['E1002', 'E2001', 'E2002', 'E3001', 'E3002', 'E3003']).has(code);
  expect(shouldFallback).toBe(Boolean(c.expected.should_fallback));
}

function valueAtPath(root: unknown, path: string): unknown {
  let cur = root as unknown;
  for (const part of path.split('.')) {
    if (Array.isArray(cur)) {
      const idx = Number(part);
      if (!Number.isInteger(idx) || idx < 0 || idx >= cur.length) return undefined;
      cur = cur[idx];
      continue;
    }
    if (cur && typeof cur === 'object') {
      const obj = cur as Record<string, unknown>;
      if (!(part in obj)) return undefined;
      cur = obj[part];
      continue;
    }
    return undefined;
  }
  return cur;
}

function evalProviderMockBehavior(c: CaseDoc): void {
  const req = (c.input.request_body ?? {}) as Record<string, unknown>;
  const resp = (c.input.response_body ?? {}) as Record<string, unknown>;
  const reqAssert = (c.expected.request_assert ?? {}) as Record<string, unknown>;
  const respAssert = (c.expected.response_assert ?? {}) as Record<string, unknown>;
  for (const [path, expected] of Object.entries(reqAssert)) {
    expect(valueAtPath(req, path)).toEqual(expected);
  }
  for (const [path, expected] of Object.entries(respAssert)) {
    expect(valueAtPath(resp, path)).toEqual(expected);
  }
}

describe('advanced capabilities compliance matrix', () => {
  const cases = loadCases(
    'tests/compliance/cases/07-advanced-capabilities/capability-and-endpoint.yaml'
  );

  for (const c of cases) {
    it(`${c.id}: ${c.name}`, () => {
      if (c.input.type === 'capability_guard') evalCapabilityGuard(c);
      if (c.input.type === 'advanced_endpoint_mapping') evalAdvancedEndpointMapping(c);
      if (c.input.type === 'fallback_decision') evalFallbackDecision(c);
      if (c.input.type === 'provider_mock_behavior') evalProviderMockBehavior(c);
    });
  }
});

