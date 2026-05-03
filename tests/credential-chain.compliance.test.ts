import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse, parseAllDocuments } from 'yaml';
import { protocolRoot } from './helpers/protocol-root.js';
import type { ProtocolManifest } from '../src/protocol/manifest.js';
import {
  REDACTED,
  buildAuthMetadata,
  diagnosticText,
  resolveCredential,
  shadowedAuth,
} from '../src/transport/index.js';

type CredentialCase = {
  id: string;
  name: string;
  input: Record<string, unknown>;
  setup: {
    manifest_path: string;
    env?: Record<string, string>;
  };
  expected: Record<string, unknown>;
};

function loadCases(): CredentialCase[] {
  const root = protocolRoot();
  const file = resolve(root, 'tests/compliance/cases/09-credential-resolution/credential-chain.yaml');
  return parseAllDocuments(readFileSync(file, 'utf-8'))
    .map((doc) => doc.toJSON() as CredentialCase | null)
    .filter((data): data is CredentialCase => Boolean(data?.id && data.input));
}

function loadManifest(root: string, relPath: string): ProtocolManifest {
  const raw = readFileSync(resolve(root, 'tests/compliance', relPath), 'utf-8');
  return parse(raw) as ProtocolManifest;
}

function withEnv<T>(env: Record<string, string> | undefined, fn: () => T): T {
  const previous = new Map<string, string | undefined>();
  for (const key of Object.keys(env ?? {})) {
    previous.set(key, process.env[key]);
  }
  for (const key of ['REPLICATE_API_TOKEN', 'REPLICATE_API_KEY', 'HEADERAUTH_TOKEN', 'QUERYAUTH_API_KEY', 'DUALAUTH_API_TOKEN', 'DUALAUTH_LEGACY_KEY']) {
    if (!previous.has(key)) previous.set(key, process.env[key]);
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(env ?? {})) {
    process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function stringifyRedacted(value: unknown): string {
  return JSON.stringify(value);
}

describe('credential-chain compliance', () => {
  const root = protocolRoot();
  const cases = loadCases().filter((c) => c.input.runtime_target !== 'wasm32-wasip1');

  it('normalizes bearer prefix separator', () => {
    const manifest = {
      id: 'prefixauth',
      endpoint: {
        base_url: 'https://example.com',
        auth: {
          type: 'bearer',
          prefix: 'Bearer',
        },
      },
    } as ProtocolManifest;
    const metadata = buildAuthMetadata(manifest, {
      value: 'secret',
      sourceKind: 'explicit',
      sourceName: 'explicit',
      requiredEnvVars: [],
      conventionalEnvVars: [],
    });

    expect(metadata.headers).toEqual({ Authorization: 'Bearer secret' });
  });

  for (const c of cases) {
    it(`${c.id}: ${c.name}`, () => {
      const manifest = loadManifest(root, c.setup.manifest_path);
      withEnv(c.setup.env, () => {
        const credential = resolveCredential(
          manifest,
          c.input.explicit_credential as string | undefined
        );
        const expectedStatus = c.expected.status as string | undefined;
        if (expectedStatus) {
          expect(credential.value ? 'available' : 'missing').toBe(expectedStatus);
        }
        expect(credential.sourceKind).toBe(c.expected.source_kind);
        expect(credential.sourceName ?? null).toBe(c.expected.source_name ?? null);
        if (Array.isArray(c.expected.required)) {
          expect(credential.requiredEnvVars).toEqual(c.expected.required);
        }

        if (Array.isArray(c.expected.conventional_fallbacks)) {
          expect(credential.conventionalEnvVars).toEqual(c.expected.conventional_fallbacks);
        }

        const metadata = buildAuthMetadata(manifest, credential, { redacted: true });
        if (c.input.type === 'auth_attachment') {
          expect(metadata.headers).toEqual((c.expected.headers as Record<string, string>) ?? {});
          expect(metadata.queryParams).toEqual(
            (c.expected.query_params as Record<string, string>) ?? {}
          );
        }

        const diagnostic = diagnosticText(manifest, credential);
        for (const needle of (c.expected.diagnostic_contains as string[]) ?? []) {
          expect(diagnostic).toContain(needle);
        }

        const shadowed = shadowedAuth(manifest);
        const shadowedText = stringifyRedacted(shadowed ?? {});
        for (const needle of (c.expected.diagnostic_should_mention as string[]) ?? []) {
          expect(shadowedText).toContain(needle);
        }

        const publicText = stringifyRedacted({
          credential: {
            sourceKind: credential.sourceKind,
            sourceName: credential.sourceName,
            requiredEnvVars: credential.requiredEnvVars,
            conventionalEnvVars: credential.conventionalEnvVars,
            value: credential.value ? REDACTED : undefined,
          },
          metadata,
          diagnostic,
          shadowed,
        });
        for (const secret of (c.expected.must_not_contain as string[]) ?? []) {
          expect(publicText).not.toContain(secret);
        }
        for (const secret of (c.expected.diagnostic_must_not_contain as string[]) ?? []) {
          expect(diagnostic).not.toContain(secret);
        }
      });
    });
  }
});
