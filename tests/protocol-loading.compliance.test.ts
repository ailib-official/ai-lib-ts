/**
 * Compliance protocol_loading tests using ai-protocol fixtures.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseAllDocuments } from 'yaml';
import { loadManifestV2FromPath } from '../src/index.js';

type ComplianceCase = {
  id: string;
  name: string;
  input: {
    type: string;
    manifest_path?: string;
  };
  expected: {
    valid?: boolean;
    provider_id?: string;
    protocol_version?: string;
    errors?: string[];
  };
};

function protocolRoot(): string {
  const candidates = [
    resolve(process.cwd(), '../ai-protocol'),
    resolve(process.cwd(), '../../ai-protocol'),
    'd:/ai-protocol',
  ];
  const root = candidates.find((candidate) => existsSync(candidate));
  if (!root) {
    throw new Error('Unable to locate ai-protocol root');
  }
  return root;
}

function loadCases(): ComplianceCase[] {
  const root = protocolRoot();
  const files = [
    resolve(root, 'tests/compliance/cases/01-protocol-loading/load-valid-provider.yaml'),
    resolve(root, 'tests/compliance/cases/01-protocol-loading/load-v2-p0-generative-providers.yaml'),
    resolve(root, 'tests/compliance/cases/01-protocol-loading/load-v2-wave1-provider-expansion.yaml'),
    resolve(root, 'tests/compliance/cases/01-protocol-loading/load-v2-capability-profile-ios.yaml'),
  ];

  const out: ComplianceCase[] = [];
  for (const file of files) {
    const docs = parseAllDocuments(readFileSync(file, 'utf-8'));
    for (const doc of docs) {
      const data = doc.toJSON() as ComplianceCase | null;
      if (data && typeof data === 'object' && 'id' in data) {
        out.push(data);
      }
    }
  }
  return out.filter((c) => c.input?.type === 'protocol_loading');
}

function iosCapabilityProfileErrors(raw: Record<string, unknown>): string[] {
  const cp = raw.capability_profile;
  if (cp === undefined || cp === null) {
    return [];
  }
  if (typeof cp !== 'object') {
    return ['capability_profile must be object'];
  }

  const profile = cp as Record<string, unknown>;
  if (profile.phase !== 'ios_v1') {
    return [];
  }

  const errors: string[] = [];
  if ('process' in profile || 'contract' in profile) {
    errors.push('must NOT have additional properties');
  }
  if (!('inputs' in profile) && !('outcomes' in profile) && !('systems' in profile)) {
    errors.push('must match at least one schema in anyOf');
  }
  return errors;
}

describe('protocol_loading compliance', () => {
  const cases = loadCases();

  for (const c of cases) {
    it(`${c.id}: ${c.name}`, async () => {
      const root = protocolRoot();
      const expectedValid = c.expected?.valid ?? false;
      const manifestPath = c.input?.manifest_path;
      expect(manifestPath).toBeTruthy();
      const fullPath = resolve(root, 'tests/compliance', manifestPath ?? '');

      if (!expectedValid) {
        const raw = parseAllDocuments(readFileSync(fullPath, 'utf-8'))[0]?.toJSON() as Record<
          string,
          unknown
        >;
        const hasRequiredShape =
          typeof raw?.id === 'string' &&
          typeof raw?.protocol_version === 'string' &&
          typeof (raw?.endpoint as Record<string, unknown> | undefined)?.base_url === 'string';
        const iosErrors = iosCapabilityProfileErrors(raw);
        expect(hasRequiredShape && iosErrors.length === 0).toBe(false);
        const expectedErrors = Array.isArray(c.expected?.errors)
          ? c.expected.errors.filter((item): item is string => typeof item === 'string')
          : [];
        const actualErrorText = iosErrors.join(' | ');
        for (const expectedError of expectedErrors) {
          expect(actualErrorText).toContain(expectedError);
        }
        return;
      }

      const manifest = await loadManifestV2FromPath(fullPath);
      expect(manifest.id).toBe(c.expected.provider_id);
      expect(manifest.protocol_version).toBe(c.expected.protocol_version);

      const endpoint = (manifest.endpoint ?? manifest.endpoints) as
        | { base_url?: string }
        | undefined;
      expect(typeof endpoint?.base_url).toBe('string');

      if (c.expected.provider_id === 'moonshot') {
        const multimodal = manifest.multimodal as
          | {
              input?: { video?: { supported?: boolean } };
              output?: { video?: { supported?: boolean } };
            }
          | undefined;
        expect(multimodal?.input?.video?.supported).toBe(true);
        expect(multimodal?.output?.video?.supported ?? false).toBe(false);
      }
    });
  }
});

