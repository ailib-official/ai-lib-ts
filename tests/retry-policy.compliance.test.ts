/**
 * Compliance retry_decision tests using ai-protocol fixtures.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseAllDocuments } from 'yaml';
import { protocolRoot } from './helpers/protocol-root.js';

type RetryCase = {
  id: string;
  name: string;
  input: {
    type: string;
    error?: {
      error_name?: string;
      retryable?: boolean;
    };
    retry_policy?: {
      max_retries?: number;
      min_delay_ms?: number;
      max_delay_ms?: number;
      retry_on_error_code?: string[];
    };
    attempt?: number;
  };
  expected: {
    should_retry?: boolean;
    delay_ms?: {
      min?: number;
      max?: number;
    };
  };
};

function loadCases(): RetryCase[] {
  const root = protocolRoot();
  const file = resolve(root, 'tests/compliance/cases/06-resilience/retry-policy.yaml');
  const docs = parseAllDocuments(readFileSync(file, 'utf-8'));
  return docs
    .map((doc) => doc.toJSON() as RetryCase | null)
    .filter((data): data is RetryCase => Boolean(data && data.input?.type === 'retry_decision'));
}

function computeRetryDelayMs(policy: RetryCase['input']['retry_policy'], attempt: number): number {
  const minDelay = policy?.min_delay_ms ?? 1000;
  const maxDelay = policy?.max_delay_ms ?? 60_000;
  const exponent = Math.max(0, attempt - 1);
  return Math.min(minDelay * 2 ** exponent, maxDelay);
}

function evaluateRetryDecision(c: RetryCase): { shouldRetry: boolean; delayMs?: number } {
  const errorName = c.input.error?.error_name ?? '';
  const retryable = c.input.error?.retryable ?? false;
  const maxRetries = c.input.retry_policy?.max_retries ?? 0;
  const attempt = c.input.attempt ?? 1;
  const policyList = c.input.retry_policy?.retry_on_error_code ?? [];
  const matchesPolicy = policyList.length === 0 || policyList.includes(errorName);
  const shouldRetry = attempt <= maxRetries && retryable && matchesPolicy;
  if (!shouldRetry) {
    return { shouldRetry };
  }
  return { shouldRetry, delayMs: computeRetryDelayMs(c.input.retry_policy, attempt) };
}

describe('retry_decision compliance', () => {
  const cases = loadCases();

  for (const c of cases) {
    it(`${c.id}: ${c.name}`, () => {
      const result = evaluateRetryDecision(c);
      expect(result.shouldRetry).toBe(Boolean(c.expected.should_retry));

      if (c.expected.should_retry && c.expected.delay_ms && result.delayMs != null) {
        expect(result.delayMs).toBeGreaterThanOrEqual(c.expected.delay_ms.min ?? 0);
        expect(result.delayMs).toBeLessThanOrEqual(c.expected.delay_ms.max ?? Number.MAX_SAFE_INTEGER);
      }
    });
  }
});

