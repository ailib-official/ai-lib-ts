/**
 * ALT-EXP-001 — Experimental Context Envelope / CapabilityTag mapping consume.
 */

import { describe, expect, it } from 'vitest';

import {
  isCriticalLayer,
  loadCapabilityTagMappingFixture,
  loadContextEnvelopeFixture,
  parseCapabilityTagMapping,
  parseContextEnvelope,
} from '../src/protocol/experimental/index.js';
import { ProtocolError } from '../src/errors/index.js';
import { protocolRoot } from './helpers/protocol-root.js';

describe('ALT-EXP-001 experimental envelope / tag mapping', () => {
  const root = protocolRoot();

  it('loads and validates context-envelope fixture (status experimental)', () => {
    const env = loadContextEnvelopeFixture(root);
    expect(env.status).toBe('experimental');
    expect(env.schema_version).toBe('0.1.0-experimental');
    expect(env.chunks.length).toBeGreaterThan(0);
    expect(env.chunks.some((c) => c.layer === 'system')).toBe(true);
    expect(env.chunks.some((c) => c.layer === 'active')).toBe(true);
  });

  it('loads and validates capability-tag-mapping fixture', () => {
    const mapping = loadCapabilityTagMappingFixture(root);
    expect(mapping.status).toBe('experimental');
    const tags = new Set(mapping.mappings.map((m) => m.capability_tag));
    expect(tags.has('tool_calling')).toBe(true);
    expect(tags.has('high-reasoning')).toBe(true);
  });

  it('isCriticalLayer matches rust ContextLayer::is_critical', () => {
    expect(isCriticalLayer('system')).toBe(true);
    expect(isCriticalLayer('active')).toBe(true);
    expect(isCriticalLayer('relevant')).toBe(false);
    expect(isCriticalLayer('archive')).toBe(false);
  });

  it('rejects stable-status envelope documents', () => {
    expect(() =>
      parseContextEnvelope(
        {
          schema_version: '0.1.0-experimental',
          status: 'stable',
          chunks: [
            {
              layer: 'system',
              chunk_id: 'x',
              role: 'system',
              content: 'hi',
            },
          ],
        },
        { protocolRoot: root },
      ),
    ).toThrow(ProtocolError);
  });

  it('rejects empty mappings', () => {
    expect(() =>
      parseCapabilityTagMapping(
        {
          schema_version: '0.1.0-experimental',
          status: 'experimental',
          mappings: [],
        },
        { protocolRoot: root },
      ),
    ).toThrow(ProtocolError);
  });
});
