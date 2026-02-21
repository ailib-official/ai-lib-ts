/**
 * Tool calling types based on AI-Protocol standard_schema
 */

/**
 * Tool definition for model context
 */
export interface ToolDefinition {
  name: string;
  description?: string;
  parameters: unknown; // JSON Schema
  strict?: boolean;
}

/**
 * Tool call from model response
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

/**
 * Parsed tool call with decoded arguments
 */
export interface ParsedToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Tool choice policy
 */
export type ToolChoice = 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };

/**
 * Tool factory functions
 */
export const Tool = {
  /**
   * Create a tool definition
   */
  define(
    name: string,
    parameters: unknown,
    description?: string,
    strict?: boolean
  ): ToolDefinition {
    const tool: ToolDefinition = {
      name,
      parameters,
    };
    if (description) {
      tool.description = description;
    }
    if (strict !== undefined) {
      tool.strict = strict;
    }
    return tool;
  },

  /**
   * Parse a tool call's arguments
   */
  parseArguments(toolCall: ToolCall): ParsedToolCall {
    const func = toolCall?.function;
    if (!func) {
      throw new Error('Invalid tool call: missing function');
    }
    const argsStr = func.arguments ?? '{}';
    return {
      id: toolCall.id,
      name: func.name,
      arguments: JSON.parse(argsStr) as Record<string, unknown>,
    };
  },

  /**
   * Try to parse tool call arguments, returning null on failure
   */
  tryParseArguments(toolCall: ToolCall): ParsedToolCall | null {
    try {
      return Tool.parseArguments(toolCall);
    } catch {
      return null;
    }
  },
};
