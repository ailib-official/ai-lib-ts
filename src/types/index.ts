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
export type { MessageRole, MessageContent, ImageSource, AudioSource } from './message.js';

export { StreamingEvent, TerminationReason } from './events.js';
export type { TerminationReasonType } from './events.js';

export { Tool } from './tool.js';
export type { ToolDefinition, ToolCall, ParsedToolCall, ToolChoice } from './tool.js';
