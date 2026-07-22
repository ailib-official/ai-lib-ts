/**
 * Validate Experimental Envelope / Tag-mapping documents against ai-protocol schemas.
 */

import Ajv2020, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ProtocolError } from '../../errors/index.js';
import type { CapabilityTagMapping, ContextEnvelope } from './types.js';

export type ExperimentalSchemaId = 'context-envelope' | 'capability-tag-mapping';

function resolveProtocolRoot(explicit?: string): string {
  const envRoot = process.env.AI_PROTOCOL_DIR ?? process.env.AI_PROTOCOL_PATH;
  const candidates = [
    explicit,
    envRoot,
    join(process.cwd(), '../ai-protocol'),
    join(process.cwd(), '../../ai-protocol'),
  ].filter((c): c is string => Boolean(c));

  const root = candidates.find((c) => existsSync(join(c, 'schemas', 'v2')));
  if (!root) {
    throw new ProtocolError(
      'Unable to locate ai-protocol root for Experimental schemas. Set AI_PROTOCOL_DIR.',
    );
  }
  return root;
}

function loadSchemaObject(protocolRoot: string, id: ExperimentalSchemaId): object {
  const path = join(protocolRoot, 'schemas', 'v2', `${id}.json`);
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  // Ajv2020 does not need the $schema URI meta-fetch for offline validation.
  const rest = { ...raw };
  delete rest.$schema;
  return rest;
}

let cached: {
  root: string;
  envelope: ValidateFunction;
  tagMapping: ValidateFunction;
} | null = null;

function validators(protocolRoot?: string): {
  envelope: ValidateFunction;
  tagMapping: ValidateFunction;
} {
  const root = resolveProtocolRoot(protocolRoot);
  if (cached?.root === root) {
    return cached;
  }
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  cached = {
    root,
    envelope: ajv.compile(loadSchemaObject(root, 'context-envelope')),
    tagMapping: ajv.compile(loadSchemaObject(root, 'capability-tag-mapping')),
  };
  return cached;
}

function formatErrors(errors: ErrorObject[] | null | undefined): string {
  if (!errors?.length) return 'unknown validation error';
  return errors.map((e) => `${e.instancePath || '/'} ${e.message ?? ''}`.trim()).join('; ');
}

/**
 * Validate and narrow an unknown document to ContextEnvelope.
 * Rejects documents that are not `status: experimental`.
 */
export function parseContextEnvelope(
  doc: unknown,
  options?: { protocolRoot?: string },
): ContextEnvelope {
  const { envelope } = validators(options?.protocolRoot);
  if (!envelope(doc)) {
    throw new ProtocolError(
      `Context Envelope validation failed: ${formatErrors(envelope.errors)}`,
    );
  }
  const typed = doc as ContextEnvelope;
  if (typed.status !== 'experimental') {
    throw new ProtocolError(
      `Context Envelope status must remain experimental (got ${String(typed.status)})`,
    );
  }
  return typed;
}

/**
 * Validate and narrow an unknown document to CapabilityTagMapping.
 */
export function parseCapabilityTagMapping(
  doc: unknown,
  options?: { protocolRoot?: string },
): CapabilityTagMapping {
  const { tagMapping } = validators(options?.protocolRoot);
  if (!tagMapping(doc)) {
    throw new ProtocolError(
      `CapabilityTag mapping validation failed: ${formatErrors(tagMapping.errors)}`,
    );
  }
  const typed = doc as CapabilityTagMapping;
  if (typed.status !== 'experimental') {
    throw new ProtocolError(
      `CapabilityTag mapping status must remain experimental (got ${String(typed.status)})`,
    );
  }
  return typed;
}

/** Load + parse the protocol fixture for Context Envelope. */
export function loadContextEnvelopeFixture(protocolRoot?: string): ContextEnvelope {
  const root = resolveProtocolRoot(protocolRoot);
  const raw = JSON.parse(
    readFileSync(join(root, 'v2', 'context-envelope.fixture.json'), 'utf8'),
  ) as unknown;
  return parseContextEnvelope(raw, { protocolRoot: root });
}

/** Load + parse the protocol fixture for CapabilityTag mapping. */
export function loadCapabilityTagMappingFixture(protocolRoot?: string): CapabilityTagMapping {
  const root = resolveProtocolRoot(protocolRoot);
  const raw = JSON.parse(
    readFileSync(join(root, 'v2', 'capability-tag-mapping.fixture.json'), 'utf8'),
  ) as unknown;
  return parseCapabilityTagMapping(raw, { protocolRoot: root });
}
