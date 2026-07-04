/**
 * Compliance tests for text tool call parsing (PT-078 / ALR-TTC-002).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseAllDocuments } from 'yaml';
import { StandardTextToolParser, parseHybridToolCalls } from '../src/types/text-tool.js';
import type { TextParsedToolCall } from '../src/types/text-tool.js';
import type { ToolDefinition } from '../src/types/tool.js';
import { protocolRoot } from './helpers/protocol-root.js';

type CaseDoc = {
  id: string;
  name: string;
  input: Record<string, unknown>;
  expected: Record<string, unknown>;
};

function loadTextToolCases(): CaseDoc[] {
  const root = protocolRoot();
  const file = resolve(root, 'tests/compliance/cases/10-text-tool-call/text-tool-parse.yaml');
  const docs = parseAllDocuments(readFileSync(file, 'utf-8'));
  return docs
    .map((doc) => doc.toJSON() as CaseDoc | null)
    .filter((data): data is CaseDoc => Boolean(data && data.id && data.input));
}

function evalTextToolParse(c: CaseDoc): void {
  const config = (c.input.config as Record<string, unknown>) ?? {};
  const parser = new StandardTextToolParser({
    lenientParsing: Boolean(config.lenient_parsing),
  });
  const { remainingText, toolCalls } = parser.parse(String(c.input.response_text ?? ''));
  if ('remaining_text' in c.expected) {
    expect(remainingText.trim()).toBe(String(c.expected.remaining_text).trim());
  }
  const expectedCalls = (c.expected.tool_calls as Array<Record<string, unknown>>) ?? [];
  expect(toolCalls.length).toBe(expectedCalls.length);
  for (let i = 0; i < expectedCalls.length; i++) {
    expect(toolCalls[i]?.name).toBe(expectedCalls[i]?.name);
    if (expectedCalls[i]?.arguments) {
      expect(toolCalls[i]?.arguments).toEqual(expectedCalls[i]?.arguments);
    }
  }
}

function evalTextToolHybrid(c: CaseDoc): void {
  const config = (c.input.config as Record<string, unknown>) ?? {};
  const parser = new StandardTextToolParser({
    lenientParsing: Boolean(config.lenient_parsing ?? true),
  });
  const nativeRaw = (c.input.native_tool_calls as Array<Record<string, unknown>>) ?? [];
  const nativeCalls: TextParsedToolCall[] = nativeRaw.map((item) => ({
    id: String(item.id ?? ''),
    name: String(item.name ?? ''),
    arguments: (item.arguments as Record<string, unknown>) ?? {},
  }));
  const { remainingText, toolCalls } = parseHybridToolCalls(
    parser,
    String(c.input.content ?? ''),
    nativeCalls,
  );
  if ('remaining_text' in c.expected) {
    expect(remainingText.trim()).toBe(String(c.expected.remaining_text).trim());
  }
  const expectedCalls = (c.expected.tool_calls as Array<Record<string, unknown>>) ?? [];
  expect(toolCalls.length).toBe(expectedCalls.length);
  for (let i = 0; i < expectedCalls.length; i++) {
    expect(toolCalls[i]?.name).toBe(expectedCalls[i]?.name);
    if (expectedCalls[i]?.arguments) {
      expect(toolCalls[i]?.arguments).toEqual(expectedCalls[i]?.arguments);
    }
  }
}

function evalTextToolPrompt(c: CaseDoc): void {
  const config = (c.input.config as Record<string, unknown>) ?? {};
  const parser = new StandardTextToolParser({
    promptLevel: (config.prompt_level as 'L1' | 'L2' | 'L3') ?? 'L1',
    locale: String(config.locale ?? 'en'),
  });
  const tools = ((c.input.tools as Array<Record<string, unknown>>) ?? []).map(
    (t): ToolDefinition => ({
      name: String(t.name ?? ''),
      description: t.description as string | undefined,
      parameters: {},
    }),
  );
  const prompt = parser.promptInstructions(tools);
  for (const needle of (c.expected.prompt_contains as string[]) ?? []) {
    expect(prompt).toContain(needle);
  }
}

describe('text tool call compliance', () => {
  for (const c of loadTextToolCases()) {
    it(`${c.id}: ${c.name}`, () => {
      const testType = c.input.type as string;
      if (testType === 'text_tool_parse') {
        evalTextToolParse(c);
      } else if (testType === 'text_tool_hybrid') {
        evalTextToolHybrid(c);
      } else if (testType === 'text_tool_prompt') {
        evalTextToolPrompt(c);
      }
    });
  }
});
