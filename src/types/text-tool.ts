/**
 * Text-based tool call parsing for LLMs without reliable native function calling.
 *
 * 文本工具调用解析：适用于不支持或不稳定 native function calling 的 provider。
 */

import type { ToolDefinition } from './tool.js';

export type PromptLevel = 'L1' | 'L2' | 'L3';

export type NativeStrategy = 'full' | 'hybrid' | 'text_only';

export type TextToolDeviation =
  | 'standard_tool_call'
  | 'shell'
  | 'bash'
  | 'dsml';

export interface KnownDialect {
  tag: string;
  mapTo?: string;
}

export interface TextToolConfig {
  lenientParsing?: boolean;
  maxCallDepth?: number;
  includeCounterexamples?: boolean;
  promptLevel?: PromptLevel;
  locale?: string;
  argsKey?: string;
  dialects?: KnownDialect[];
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

export interface ToolCallingPolicy {
  nativeStrategy: NativeStrategy;
  parser: StandardTextToolParser;
  sendNativeToolSpecs(): boolean;
  preferNativeDispatcher(): boolean;
}

const TOOL_CALL_BLOCK_RE = /<tool_call(?:\s+[^>]*)?>([\s\S]*?)<\/tool_call>/g;
const SHELL_DIALECT_RE = /<shell>\s*<command>([\s\S]*?)<\/command>\s*<\/shell>/;
const SHELL_PLAIN_BODY_RE = /<shell>\s*([\s\S]*?)\s*<\/shell>/;
const BASH_DIALECT_RE = /<bash>([\s\S]*?)<\/bash>/;
const OUTER_WRAPPER_RE = /<tool_calls>\s*([\s\S]*?)\s*<\/tool_calls>/;
const NAME_ATTR_RE = /name="([^"]+)"/;
// DeepSeek DSML: `<` + `｜｜DSML｜｜` (U+FF5C fullwidth vertical line)
const DSML_TAG = '\uFF5C\uFF5CDSML\uFF5C\uFF5C';
const DSML_INVOKE_RE = new RegExp(
  `<${DSML_TAG}invoke\\s+name="([^"]+)">([\\s\\S]*?)</${DSML_TAG}invoke>`,
  'g',
);
const DSML_PARAMETER_RE = new RegExp(
  `<${DSML_TAG}parameter\\s+name="([^"]+)"[^>]*>([\\s\\S]*?)</${DSML_TAG}parameter>`,
  'g',
);
const DSML_WRAPPER_RE = new RegExp(
  `<${DSML_TAG}tool_calls>\\s*([\\s\\S]*?)\\s*</${DSML_TAG}tool_calls>`,
);
// Hybrid DSML+JSON (ttc-010 / ttc-015): tool_call(s) or _call wrapping standard JSON body.
const DSML_TOOL_CALL_RE = new RegExp(
  `<${DSML_TAG}(?:tool_calls?|_call)(?:\\s+[^>]*)?>([\\s\\S]*?)</${DSML_TAG}(?:tool_calls?|_call)>`,
  'g',
);

function defaultLenientParser(): StandardTextToolParser {
  return new StandardTextToolParser({
    lenientParsing: true,
    promptLevel: 'L2',
    includeCounterexamples: true,
  });
}

function inferNativeStrategy(toolCalling: Record<string, unknown>): NativeStrategy {
  const native = (toolCalling.native ?? {}) as Record<string, unknown>;
  if (!native.supported) return 'text_only';

  const reliability = String(native.reliability ?? 'unreliable');
  const hasTextFallback = toolCalling.text_fallback != null;

  if (reliability === 'full') return 'full';
  if (reliability === 'partial' && hasTextFallback) return 'hybrid';
  if (reliability === 'partial') return 'full';
  if (hasTextFallback) return 'text_only';
  return 'full';
}

export function createToolCallingPolicy(
  toolCalling: Record<string, unknown> | null | undefined,
): ToolCallingPolicy {
  const parser =
    toolCalling != null
      ? StandardTextToolParser.fromManifestToolCalling(toolCalling)
      : defaultLenientParser();
  const nativeStrategy =
    toolCalling != null ? inferNativeStrategy(toolCalling) : 'text_only';
  return {
    nativeStrategy,
    parser,
    sendNativeToolSpecs() {
      return nativeStrategy === 'full' || nativeStrategy === 'hybrid';
    },
    preferNativeDispatcher() {
      return this.sendNativeToolSpecs();
    },
  };
}

export function detectTextToolDeviation(text: string): TextToolDeviation | null {
  if (text.includes(DSML_TAG)) return 'dsml';
  if (SHELL_DIALECT_RE.test(text) || SHELL_PLAIN_BODY_RE.test(text)) return 'shell';
  if (BASH_DIALECT_RE.test(text)) return 'bash';
  if (/<tool_call(?:\s+[^>]*)?>/.test(text)) return 'standard_tool_call';
  return null;
}

export interface TextToolParseLike {
  parse(responseText: string): { remainingText: string; toolCalls: TextParsedToolCall[] };
}

export function parseHybridToolCalls(
  parser: TextToolParseLike,
  content: string,
  nativeCalls: TextParsedToolCall[],
): { remainingText: string; toolCalls: TextParsedToolCall[] } {
  if (nativeCalls.length > 0) {
    return { remainingText: content, toolCalls: [...nativeCalls] };
  }
  return parser.parse(content);
}

function shellToolCall(command: string, mapTo: string, idx: number): TextParsedToolCall {
  const name = mapTo || 'shell';
  return { id: `text_tool_${idx}`, name, arguments: { command } };
}

function tryParseConfiguredDialects(
  text: string,
  dialects: KnownDialect[],
): { call: TextParsedToolCall; span: { start: number; end: number } } | null {
  for (const dialect of dialects) {
    if (dialect.tag === 'shell') {
      const structured = SHELL_DIALECT_RE.exec(text);
      if (structured) {
        const cmd = (structured[1] ?? '').trim();
        return {
          call: shellToolCall(cmd, dialect.mapTo ?? '', 0),
          span: {
            start: structured.index ?? 0,
            end: (structured.index ?? 0) + structured[0].length,
          },
        };
      }
      const plain = SHELL_PLAIN_BODY_RE.exec(text);
      if (plain) {
        const body = (plain[1] ?? '').trim();
        if (body.startsWith('<command>')) continue;
        return {
          call: shellToolCall(body, dialect.mapTo ?? '', 0),
          span: { start: plain.index ?? 0, end: (plain.index ?? 0) + plain[0].length },
        };
      }
    } else if (dialect.tag === 'bash') {
      const bash = BASH_DIALECT_RE.exec(text);
      if (bash) {
        const cmd = (bash[1] ?? '').trim();
        return {
          call: shellToolCall(cmd, dialect.mapTo ?? '', 0),
          span: { start: bash.index ?? 0, end: (bash.index ?? 0) + bash[0].length },
        };
      }
    }
  }
  return null;
}

function tryParseLegacyDialects(
  text: string,
): { call: TextParsedToolCall; span: { start: number; end: number } } | null {
  const structured = SHELL_DIALECT_RE.exec(text);
  if (structured) {
    const cmd = (structured[1] ?? '').trim();
    return {
      call: shellToolCall(cmd, 'shell', 0),
      span: { start: structured.index ?? 0, end: (structured.index ?? 0) + structured[0].length },
    };
  }
  const plain = SHELL_PLAIN_BODY_RE.exec(text);
  if (plain) {
    const body = (plain[1] ?? '').trim();
    if (!body.startsWith('<command>')) {
      return {
        call: shellToolCall(body, 'shell', 0),
        span: { start: plain.index ?? 0, end: (plain.index ?? 0) + plain[0].length },
      };
    }
  }
  const bash = BASH_DIALECT_RE.exec(text);
  if (bash) {
    const cmd = (bash[1] ?? '').trim();
    return {
      call: shellToolCall(cmd, 'shell', 0),
      span: { start: bash.index ?? 0, end: (bash.index ?? 0) + bash[0].length },
    };
  }
  return null;
}

function parseDsmlDialect(text: string): {
  toolCalls: TextParsedToolCall[];
  spansToRemove: Array<{ start: number; end: number }>;
} {
  const toolCalls: TextParsedToolCall[] = [];
  let spansToRemove: Array<{ start: number; end: number }> = [];

  // Hybrid DSML tool_call + JSON (ttc-010) before invoke/parameter (ttc-007).
  for (const match of text.matchAll(DSML_TOOL_CALL_RE)) {
    const full = match[0];
    const body = match[1] ?? '';
    const attrName = extractNameFromOpenTag(full);
    const parsed = parseJsonBody(body, attrName);
    if (!parsed) continue;
    const idx = toolCalls.length;
    toolCalls.push({
      id: `text_tool_${idx}`,
      name: parsed.name,
      arguments: parsed.arguments,
    });
    spansToRemove.push({
      start: match.index ?? 0,
      end: (match.index ?? 0) + full.length,
    });
  }

  for (const match of text.matchAll(DSML_INVOKE_RE)) {
    const toolName = (match[1] ?? '').trim();
    if (!toolName) continue;
    const fullStart = match.index ?? 0;
    const fullEnd = fullStart + match[0].length;
    if (spansToRemove.some((s) => fullStart >= s.start && fullEnd <= s.end)) {
      continue;
    }
    const body = match[2] ?? '';
    const arguments_: Record<string, unknown> = {};
    for (const param of body.matchAll(DSML_PARAMETER_RE)) {
      const key = param[1] ?? '';
      const value = (param[2] ?? '').trim();
      if (key) arguments_[key] = value;
    }
    const idx = toolCalls.length;
    toolCalls.push({ id: `text_tool_${idx}`, name: toolName, arguments: arguments_ });
    spansToRemove.push({ start: fullStart, end: fullEnd });
  }

  if (toolCalls.length > 0) {
    const wrapper = DSML_WRAPPER_RE.exec(text);
    if (wrapper) {
      const wStart = wrapper.index ?? 0;
      const wEnd = wStart + wrapper[0].length;
      // Prefer full wrapper span when invoke blocks live inside tool_calls.
      if (!spansToRemove.some((s) => s.start === wStart && s.end === wEnd)) {
        const onlyInside =
          spansToRemove.length > 0 &&
          spansToRemove.every((s) => s.start >= wStart && s.end <= wEnd);
        if (onlyInside) {
          spansToRemove = [{ start: wStart, end: wEnd }];
        }
      }
    }
  }

  return { toolCalls, spansToRemove };
}

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
  config: Pick<TextToolConfig, 'lenientParsing' | 'dialects'>,
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
    const { toolCalls: dsmlCalls, spansToRemove: dsmlSpans } = parseDsmlDialect(remaining);
    if (dsmlCalls.length > 0) {
      toolCalls.push(...dsmlCalls);
      spansToRemove.push(...dsmlSpans);
    } else {
      const dialects = config.dialects ?? [];
      const dialectResult =
        dialects.length > 0
          ? tryParseConfiguredDialects(remaining, dialects)
          : tryParseLegacyDialects(remaining);
      if (dialectResult) {
        toolCalls.push(dialectResult.call);
        spansToRemove.push(dialectResult.span);
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
      dialects: this.config.dialects,
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
      dialects: [],
    };
    const fallback = toolCalling.text_fallback;
    if (fallback != null && fallback !== false) {
      const fb = (typeof fallback === 'object' ? fallback : {}) as Record<string, unknown>;
      const level = String(fb.prompt_level ?? 'L2').toUpperCase();
      if (level === 'L1' || level === 'L2' || level === 'L3') {
        config.promptLevel = level;
      }
      if (typeof fb.args_key === 'string') {
        config.argsKey = fb.args_key;
      }
      const known = fb.known_dialects;
      if (Array.isArray(known)) {
        for (const entry of known) {
          if (!entry || typeof entry !== 'object') continue;
          const tag = (entry as Record<string, unknown>).tag;
          if (typeof tag !== 'string' || !tag) continue;
          const mapTo = (entry as Record<string, unknown>).map_to;
          config.dialects!.push({
            tag,
            mapTo: typeof mapTo === 'string' ? mapTo : '',
          });
        }
      }
      config.includeCounterexamples = config.promptLevel !== 'L1';
    }
    const native = (toolCalling.native ?? {}) as Record<string, unknown>;
    if (native.reliability === 'full') {
      config.lenientParsing = false;
    }
    return new StandardTextToolParser(config);
  }
}
