/**
 * Text-based tool call parsing for LLMs without reliable native function calling.
 *
 * 文本工具调用解析：适用于不支持或不稳定 native function calling 的 provider。
 */

import type { ToolDefinition } from './tool.js';

export type PromptLevel = 'L1' | 'L2' | 'L3';

export interface TextToolConfig {
  lenientParsing?: boolean;
  maxCallDepth?: number;
  includeCounterexamples?: boolean;
  promptLevel?: PromptLevel;
  locale?: string;
  argsKey?: string;
}

export interface TextParsedToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface TextToolResult {
  toolUseId: string;
  content: unknown;
  isError?: boolean;
}

const TOOL_CALL_BLOCK_RE = /<tool_call(?:\s+[^>]*)?>([\s\S]*?)<\/tool_call>/g;
const SHELL_DIALECT_RE = /<shell>\s*<command>([\s\S]*?)<\/command>\s*<\/shell>/;
const BASH_DIALECT_RE = /<bash>([\s\S]*?)<\/bash>/;
const OUTER_WRAPPER_RE = /<tool_calls>\s*([\s\S]*?)\s*<\/tool_calls>/;
const NAME_ATTR_RE = /name="([^"]+)"/;

function unwrapToolCallsWrapper(text: string): string {
  const match = OUTER_WRAPPER_RE.exec(text);
  return match?.[1] ?? text;
}

function extractNameFromOpenTag(fullMatch: string): string | undefined {
  const match = NAME_ATTR_RE.exec(fullMatch);
  return match?.[1];
}

function normalizeArguments(obj: Record<string, unknown>): Record<string, unknown> {
  if ('arguments' in obj && typeof obj.arguments === 'object' && obj.arguments !== null) {
    return obj.arguments as Record<string, unknown>;
  }
  for (const key of ['parameters', 'params', 'args']) {
    if (key in obj && typeof obj[key] === 'object' && obj[key] !== null) {
      return obj[key] as Record<string, unknown>;
    }
  }
  const args = { ...obj };
  delete args.name;
  delete args.id;
  delete args.type;
  return args;
}

function parseJsonBody(
  body: string,
  attrName?: string,
): { name: string; arguments: Record<string, unknown> } | null {
  const trimmed = body.trim();
  if (!trimmed) return null;
  try {
    const value = JSON.parse(trimmed) as Record<string, unknown>;
    const name =
      typeof value.name === 'string' && value.name ? value.name : attrName;
    if (!name) return null;
    return { name, arguments: normalizeArguments(value) };
  } catch {
    return null;
  }
}

function parseTextToolCalls(
  text: string,
  config: Required<Pick<TextToolConfig, 'lenientParsing'>>,
): { remainingText: string; toolCalls: TextParsedToolCall[] } {
  const toolCalls: TextParsedToolCall[] = [];
  let remaining = config.lenientParsing ? unwrapToolCallsWrapper(text) : text;
  const spansToRemove: Array<{ start: number; end: number }> = [];

  for (const match of remaining.matchAll(TOOL_CALL_BLOCK_RE)) {
    const full = match[0];
    const body = match[1] ?? '';
    const attrName = config.lenientParsing ? extractNameFromOpenTag(full) : undefined;
    const parsed = parseJsonBody(body, attrName);
    if (!parsed) continue;
    const idx = toolCalls.length;
    toolCalls.push({
      id: `text_tool_${idx}`,
      name: parsed.name,
      arguments: parsed.arguments,
    });
    spansToRemove.push({ start: match.index ?? 0, end: (match.index ?? 0) + full.length });
  }

  if (config.lenientParsing && toolCalls.length === 0) {
    const shellMatch = SHELL_DIALECT_RE.exec(remaining);
    if (shellMatch) {
      const cmd = (shellMatch[1] ?? '').trim();
      toolCalls.push({ id: 'text_tool_0', name: 'shell', arguments: { command: cmd } });
      spansToRemove.push({
        start: shellMatch.index ?? 0,
        end: (shellMatch.index ?? 0) + shellMatch[0].length,
      });
    } else {
      const bashMatch = BASH_DIALECT_RE.exec(remaining);
      if (bashMatch) {
        const cmd = (bashMatch[1] ?? '').trim();
        toolCalls.push({ id: 'text_tool_0', name: 'shell', arguments: { command: cmd } });
        spansToRemove.push({
          start: bashMatch.index ?? 0,
          end: (bashMatch.index ?? 0) + bashMatch[0].length,
        });
      }
    }
  }

  spansToRemove.sort((a, b) => a.start - b.start);
  let remainingText = remaining;
  for (const span of [...spansToRemove].reverse()) {
    remainingText =
      remainingText.slice(0, span.start) + remainingText.slice(span.end);
  }
  remainingText = remainingText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();

  return { remainingText, toolCalls };
}

function generatePromptInstructions(
  tools: ToolDefinition[],
  config: TextToolConfig,
): string {
  const toolList = tools.map((t) => `- ${t.name}: ${t.description ?? ''}`).join('\n');
  const isZh = (config.locale ?? 'en').startsWith('zh');
  const level = config.promptLevel ?? 'L1';

  if (level === 'L1' && isZh) {
    return (
      '## 工具调用协议\n\n' +
      '<tool_call>\n{"name": "工具名", "arguments": {"参数": "值"}}\n</tool_call>\n\n' +
      `可用工具：\n${toolList}`
    );
  }
  if (level === 'L1') {
    return (
      '## Tool Use Protocol\n\n' +
      '<tool_call>\n{"name": "tool_name", "arguments": {"param": "value"}}\n</tool_call>\n\n' +
      `Available tools:\n${toolList}`
    );
  }
  if (level === 'L2' && isZh) {
    return (
      '## 工具调用协议\n\n' +
      '<tool_call>\n{"name": "工具名", "arguments": {"参数": "值"}}\n</tool_call>\n\n' +
      '关键规则：\n' +
      '- 只能使用 <tool_call>。<shell>、<bash>、<function> 将被忽略。\n' +
      '- JSON 必须包含 "name" 和 "arguments"。\n\n' +
      `可用工具：\n${toolList}`
    );
  }
  if (level === 'L2') {
    return (
      '## Tool Use Protocol\n\n' +
      '<tool_call>\n{"name": "tool_name", "arguments": {"param": "value"}}\n</tool_call>\n\n' +
      'CRITICAL RULES:\n' +
      '- Use <tool_call> ONLY. <shell>, <bash>, <function> WILL BE IGNORED.\n' +
      '- JSON must contain "name" (string) and "arguments" (object).\n' +
      '- Do NOT wrap in <tool_calls> or any other tag.\n\n' +
      `Available tools:\n${toolList}`
    );
  }
  return (
    '## Tool Use Protocol — Example\n\n' +
    '<tool_call>\n{"name": "shell", "arguments": {"command": "ls -la"}}\n</tool_call>\n\n' +
    'CRITICAL: <shell>, <bash>, <function> formats WILL BE IGNORED.\n\n' +
    `Available tools:\n${toolList}`
  );
}

export class StandardTextToolParser {
  private readonly config: TextToolConfig;

  constructor(config: TextToolConfig = {}) {
    this.config = config;
  }

  parse(responseText: string): { remainingText: string; toolCalls: TextParsedToolCall[] } {
    return parseTextToolCalls(responseText, {
      lenientParsing: this.config.lenientParsing ?? false,
    });
  }

  promptInstructions(tools: ToolDefinition[]): string {
    return generatePromptInstructions(tools, this.config);
  }

  formatResults(results: TextToolResult[]): string {
    return results
      .map((r) => {
        const body = JSON.stringify({
          tool_use_id: r.toolUseId,
          content: r.content,
          is_error: r.isError ?? false,
        });
        return `<tool_result>\n${body}\n</tool_result>`;
      })
      .join('\n');
  }

  static fromManifestToolCalling(toolCalling: Record<string, unknown>): StandardTextToolParser {
    const config: TextToolConfig = {
      lenientParsing: true,
      promptLevel: 'L2',
    };
    const fallback = (toolCalling.text_fallback ?? {}) as Record<string, unknown>;
    const level = String(fallback.prompt_level ?? 'L2').toUpperCase();
    if (level === 'L1' || level === 'L2' || level === 'L3') {
      config.promptLevel = level;
    }
    if (typeof fallback.args_key === 'string') {
      config.argsKey = fallback.args_key;
    }
    config.includeCounterexamples = config.promptLevel !== 'L1';
    const native = (toolCalling.native ?? {}) as Record<string, unknown>;
    if (native.reliability === 'full') {
      config.lenientParsing = false;
    }
    return new StandardTextToolParser(config);
  }
}
