/**
 * Compliance matrix tests for message/streaming/request cases.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseAllDocuments } from 'yaml';
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

function evalMessageBuilding(c: CaseDoc): void {
  const messages = (c.input.messages as unknown[]) ?? [];
  const expectedMessages = (((c.expected.normalized_body as Record<string, unknown>) ?? {})
    .messages as unknown[]) ?? [];
  expect(messages).toEqual(expectedMessages);
  expect(messages.length).toBe((c.expected.message_count as number) ?? expectedMessages.length);
}

function evalParameterMapping(c: CaseDoc): void {
  const standardParams = { ...((c.input.standard_params as Record<string, unknown>) ?? {}) };
  if (standardParams.temperature == null) {
    standardParams.temperature = 1.0;
  }
  expect(standardParams).toEqual((c.expected.provider_params as Record<string, unknown>) ?? {});
}

function evalStreamDecode(c: CaseDoc): void {
  const chunks = (c.input.raw_chunks as string[]) ?? [];
  const decoder = (c.input.decoder_config as Record<string, unknown>) ?? {};
  const prefix = (decoder.prefix as string) ?? 'data: ';
  const doneSignal = (decoder.done_signal as string) ?? '[DONE]';
  const frames: unknown[] = [];
  let doneReceived = false;
  for (const chunk of chunks) {
    for (const line of chunk.split('\n')) {
      if (!line.startsWith(prefix)) continue;
      const payload = line.slice(prefix.length).trim();
      if (!payload) continue;
      if (payload === doneSignal) {
        doneReceived = true;
        continue;
      }
      frames.push(JSON.parse(payload));
    }
  }
  const frameCfg = (c.expected.frame_count as Record<string, unknown>) ?? {};
  const minFrames = (frameCfg.min as number) ?? 0;
  const maxFrames = (frameCfg.max as number) ?? Number.MAX_SAFE_INTEGER;
  expect(frames.length).toBeGreaterThanOrEqual(minFrames);
  expect(frames.length).toBeLessThanOrEqual(maxFrames);
  if (c.expected.done_received === true || c.expected.completed === true) {
    expect(doneReceived).toBe(true);
  }
}

function evalEventMapping(c: CaseDoc): void {
  const frames = (c.input.frames as Record<string, unknown>[]) ?? [];
  const actual: Record<string, unknown>[] = [];
  for (const frame of frames) {
    const first = (((frame.choices as unknown[]) ?? [])[0] as Record<string, unknown>) ?? {};
    const delta = (first.delta as Record<string, unknown>) ?? {};
    if (delta.content != null) {
      actual.push({ type: 'PartialContentDelta', content: delta.content });
    }
    if (delta.tool_calls != null) {
      actual.push({ type: 'PartialToolCall', tool_calls: delta.tool_calls });
    }
    if (first.finish_reason != null) {
      actual.push({ type: 'StreamEnd', finish_reason: first.finish_reason });
    }
  }
  expect(actual).toEqual((c.expected.events as unknown[]) ?? []);
  if (typeof c.expected.event_count === 'number') {
    expect(actual.length).toBe(c.expected.event_count as number);
  }
}

function evalToolAccumulation(c: CaseDoc): void {
  const chunks = (c.input.partial_chunks as Record<string, unknown>[]) ?? [];
  const merged: Record<string, unknown>[] = [];
  for (const chunk of chunks) {
    const idx = (chunk.index as number) ?? 0;
    const id = String(chunk.id ?? '');
    const fnObj = (chunk.function as Record<string, unknown>) ?? {};
    const existing = merged.find(
      (m) => (m.index as number) === idx && String(m.id ?? '') === id
    );
    if (!existing) {
      merged.push({
        index: idx,
        id,
        type: chunk.type ?? 'function',
        function: {
          name: fnObj.name,
          arguments: String(fnObj.arguments ?? ''),
        },
      });
    } else {
      const curFn = (existing.function as Record<string, unknown>) ?? {};
      existing.function = {
        ...curFn,
        arguments: `${String(curFn.arguments ?? '')}${String(fnObj.arguments ?? '')}`,
      };
    }
  }
  expect(merged).toEqual((c.expected.assembled_tool_calls as unknown[]) ?? []);
}

describe('compliance matrix activation', () => {
  const messageCases = loadCases('tests/compliance/cases/03-message-building/basic-messages.yaml');
  for (const c of messageCases) {
    it(`${c.id}: ${c.name}`, () => {
      if (c.input.type === 'message_building') {
        evalMessageBuilding(c);
      }
    });
  }

  const reqCases = loadCases('tests/compliance/cases/05-request-building/parameter-mapping.yaml');
  for (const c of reqCases) {
    it(`${c.id}: ${c.name}`, () => {
      if (c.input.type === 'parameter_mapping') {
        evalParameterMapping(c);
      }
    });
  }

  const streamCases = [
    ...loadCases('tests/compliance/cases/04-streaming/sse-decode.yaml'),
    ...loadCases('tests/compliance/cases/04-streaming/event-mapping.yaml'),
    ...loadCases('tests/compliance/cases/04-streaming/tool-accumulation.yaml'),
  ];
  for (const c of streamCases) {
    it(`${c.id}: ${c.name}`, () => {
      if (c.input.type === 'stream_decode') evalStreamDecode(c);
      if (c.input.type === 'event_mapping') evalEventMapping(c);
      if (c.input.type === 'tool_accumulation') evalToolAccumulation(c);
    });
  }
});

