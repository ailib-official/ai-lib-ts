/**
 * OpenAI-compatible thinking / reasoning field extraction (ALT-RSN-001).
 * 中文：从 delta/message 结构化字段提取思考文本；单一别名表，供 pipeline 与
 * non-stream 解析共用（GOV-007 / X-RUNTIME-MIRROR of ALR-RSN-001）。
 */

/** Wire keys observed across OpenAI-compatible reasoners / proxies. Preference order. */
export const OPENAI_COMPAT_THINKING_KEYS = [
  'reasoning_content',
  'reasoning',
  'thinking',
  'thought',
  'reasoning_text',
  'analysis',
] as const;

export function firstNonemptyStringField(
  obj: unknown,
  keys: readonly string[]
): string | undefined {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return undefined;
  const record = obj as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

/** Thinking text from `choices[0].delta.*` (streaming). */
export function thinkingFromOpenaiCompatDelta(
  frame: Record<string, unknown>
): string | undefined {
  const choices = frame.choices;
  if (!Array.isArray(choices) || choices.length === 0) return undefined;
  const first = choices[0];
  if (!first || typeof first !== 'object' || Array.isArray(first)) return undefined;
  return firstNonemptyStringField(
    (first as Record<string, unknown>).delta,
    OPENAI_COMPAT_THINKING_KEYS
  );
}

/** Thinking text from `choices[0].message.*` (non-streaming). */
export function thinkingFromOpenaiCompatMessage(
  frame: Record<string, unknown>
): string | undefined {
  const choices = frame.choices;
  if (!Array.isArray(choices) || choices.length === 0) return undefined;
  const first = choices[0];
  if (!first || typeof first !== 'object' || Array.isArray(first)) return undefined;
  return firstNonemptyStringField(
    (first as Record<string, unknown>).message,
    OPENAI_COMPAT_THINKING_KEYS
  );
}
