/**
 * Core type definitions for AI-Protocol TypeScript Runtime
 *
 * This module provides strongly-typed representations for all AI interaction
 * primitives based on the AI-Protocol standard schema.
 *
 * @module types
 */

// Re-export all types and values from submodules
export { Message, ContentBlock, guessMediaType } from './message.js';
export type {
  MessageRole,
  MessageContent,
  ImageSource,
  AudioSource,
  VideoSource,
  OmniSource,
} from './message.js';

export { StreamingEvent, TerminationReason } from './events.js';
export type { TerminationReasonType } from './events.js';

export { Tool } from './tool.js';
export type { ToolDefinition, ToolCall, ParsedToolCall, ToolChoice } from './tool.js';

export {
  StandardTextToolParser,
  createToolCallingPolicy,
  detectTextToolDeviation,
  parseHybridToolCalls,
} from './text-tool.js';
export type {
  PromptLevel,
  NativeStrategy,
  KnownDialect,
  TextToolConfig,
  TextParsedToolCall,
  TextToolResult,
  TextToolDeviation,
  TextToolParseLike,
  ToolCallingPolicy,
} from './text-tool.js';

export type {
  ExecutionMetadata,
  ExecutionResult,
  ExecutionUsage,
} from './execution-result.js';

export {
  encodeBlocksAnthropic,
  encodeBlocksGemini,
  encodeBlocksForAnthropicContract,
  encodeBlocksForGeminiContract,
  encodeBlocksForApiStyle,
} from './manifest-encode.js';
export type { EncodeBlock, EncodedWire } from './manifest-encode.js';
