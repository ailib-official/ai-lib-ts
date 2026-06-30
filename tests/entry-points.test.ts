/**
 * PT-073g ALT-QA-001-R1 — E/P subpath entry smoke tests.
 */

import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const distRoot = join(import.meta.dirname, '..', 'dist');

describe('published entry points', () => {
  it('dist artifacts exist for index, core, and contact', () => {
    for (const name of ['index', 'core', 'contact']) {
      expect(existsSync(join(distRoot, `${name}.js`))).toBe(true);
      expect(existsSync(join(distRoot, `${name}.cjs`))).toBe(true);
      expect(
        existsSync(join(distRoot, `${name}.d.ts`)) ||
          existsSync(join(distRoot, `${name}.d.cts`))
      ).toBe(true);
    }
  });

  it('root entry exports AiClient', async () => {
    const mod = await import('../dist/index.js');
    expect(mod.AiClient).toBeDefined();
    expect(mod.RetryPolicy).toBeDefined();
  });

  it('core entry exports E-layer client without resilience', async () => {
    const mod = await import('../dist/core.js');
    expect(mod.AiClient).toBeDefined();
    expect(mod.HttpTransport).toBeDefined();
    expect(mod.RetryPolicy).toBeUndefined();
  });

  it('contact entry exports P-layer modules', async () => {
    const mod = await import('../dist/contact.js');
    expect(mod.RetryPolicy).toBeDefined();
    expect(mod.ModelManager).toBeDefined();
    expect(mod.Guardrails).toBeDefined();
    expect(mod.AiClient).toBeUndefined();
  });
});

describe('core E/P boundary (source graph)', () => {
  it('core barrel does not re-export resilience', async () => {
    const mod = await import('../src/core.js');
    expect(mod.RetryPolicy).toBeUndefined();
    expect(mod.ModelManager).toBeUndefined();
  });

  it('contact barrel aggregates P modules', async () => {
    const mod = await import('../src/contact.js');
    expect(mod.RetryPolicy).toBeDefined();
    expect(mod.ModelManager).toBeDefined();
  });
});
