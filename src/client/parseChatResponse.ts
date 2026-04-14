/**
 * Non-streaming chat JSON → unified client response (ai-lib-rust / Python parity).
 */

import type { ProtocolManifest } from '../protocol/manifest.js';
import { getStringAtPath, getValueAtPath } from '../protocol/jsonPath.js';
import type { ChatResponsePayload } from './responseTypes.js';

function responsePaths(manifest: ProtocolManifest): Record<string, string | undefined> | undefined {
  const rp = manifest.response_paths;
  if (!rp || typeof rp !== 'object') return undefined;
  return rp as Record<string, string | undefined>;
}

export function parseNonstreamChatResponse(
  manifest: ProtocolManifest,
  raw: Record<string, unknown>
): ChatResponsePayload {
  const rp = responsePaths(manifest);

  const contentPaths: (string | undefined)[] = [];
  if (rp?.content) contentPaths.push(rp.content);
  contentPaths.push('choices[0].message.content');

  let content = '';
  for (const p of contentPaths) {
    if (!p?.trim()) continue;
    const s = getStringAtPath(raw, p);
    if (s) {
      content = s;
      break;
    }
  }

  if (!content) {
    const reasoning: (string | undefined)[] = [];
    if (rp?.reasoning_content) reasoning.push(rp.reasoning_content);
    if (rp?.reasoning) reasoning.push(rp.reasoning);
    reasoning.push('choices[0].message.reasoning_content');
    for (const p of reasoning) {
      if (!p?.trim()) continue;
      const s = getStringAtPath(raw, p);
      if (s) {
        content = s;
        break;
      }
    }
  }

  let usage: ChatResponsePayload['usage'];
  let usageRaw: Record<string, unknown> | undefined;
  if (rp?.usage) {
    const u = getValueAtPath(raw, rp.usage);
    if (u && typeof u === 'object' && !Array.isArray(u)) {
      usageRaw = u as Record<string, unknown>;
    }
  }
  if (!usageRaw && raw.usage && typeof raw.usage === 'object' && !Array.isArray(raw.usage)) {
    usageRaw = raw.usage as Record<string, unknown>;
  }
  if (usageRaw) {
    usage = {
      promptTokens: usageRaw.prompt_tokens as number | undefined,
      completionTokens: usageRaw.completion_tokens as number | undefined,
      totalTokens: usageRaw.total_tokens as number | undefined,
    };
  }

  let finishReason: string | undefined;
  if (rp?.finish_reason) {
    const fr = getStringAtPath(raw, rp.finish_reason);
    if (fr) finishReason = fr;
  }

  const choices = raw.choices as Array<Record<string, unknown>> | undefined;
  if (choices && choices.length > 0) {
    const choice = choices[0];
    const message = (choice?.message as Record<string, unknown> | undefined) ?? {};
    if (!content) {
      const c = message.content;
      if (typeof c === 'string' && c) content = c;
    }
    if (!finishReason && typeof choice.finish_reason === 'string') {
      finishReason = choice.finish_reason;
    }
    let toolCalls: ChatResponsePayload['toolCalls'];
    if (rp?.tool_calls) {
      const tc = getValueAtPath(raw, rp.tool_calls);
      if (Array.isArray(tc)) toolCalls = tc as ChatResponsePayload['toolCalls'];
    }
    if (!toolCalls && Array.isArray(message.tool_calls)) {
      toolCalls = message.tool_calls as ChatResponsePayload['toolCalls'];
    }
    return { content, toolCalls, usage, finishReason };
  }

  if (Array.isArray(raw.content)) {
    const blocks = raw.content as Array<Record<string, unknown>>;
    const textParts: string[] = [];
    const toolCalls: NonNullable<ChatResponsePayload['toolCalls']> = [];
    for (const block of blocks) {
      if (block.type === 'text' && typeof block.text === 'string') {
        textParts.push(block.text);
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: String(block.id ?? ''),
          type: 'function',
          function: {
            name: String(block.name ?? ''),
            arguments: JSON.stringify(block.input ?? {}),
          },
        });
      }
    }
    if (!content) content = textParts.join('');
    return {
      content,
      toolCalls: toolCalls.length ? toolCalls : undefined,
      usage,
      finishReason: (raw.stop_reason as string | undefined) ?? finishReason,
    };
  }

  return { content, usage, finishReason };
}
