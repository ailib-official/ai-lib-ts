/**
 * MCP tool bridge - converts between MCP tools and AI-Protocol tool format.
 */

import type { McpTool, McpToolInvocation, McpToolResult } from './types.js';
import type { ToolDefinition } from '../types/tool.js';

export interface McpToolBridgeOptions {
  allowFilter?: Set<string>;
  denyFilter?: Set<string>;
}

/**
 * Converts MCP tools to AI-Protocol ToolDefinition format
 */
export class McpToolBridge {
  private readonly namespace: string;
  private readonly allow: Set<string>;
  private readonly deny: Set<string>;

  constructor(serverName: string, options: McpToolBridgeOptions = {}) {
    this.namespace = `mcp__${serverName}__`;
    this.allow = options.allowFilter ?? new Set();
    this.deny = options.denyFilter ?? new Set();
  }

  mcpToolsToProtocol(mcpTools: McpTool[]): ToolDefinition[] {
    return mcpTools
      .filter((t) => this.isAllowed(t.name))
      .map((t) => this.convertTool(t));
  }

  protocolCallToMcp(call: { name?: string; arguments?: unknown }): McpToolInvocation | null {
    const name = call.name ?? '';
    const original = this.stripNamespace(name);
    if (original === null) return null;
    return {
      name: original,
      arguments: (call.arguments as Record<string, unknown>) ?? {},
    };
  }

  mcpResultToProtocol(toolCallId: string, result: McpToolResult): { tool_use_id: string; content: unknown; is_error?: boolean } {
    const content = result.content ?? [];
    const textParts = content
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '');
    const text = textParts.join('\n');
    return {
      tool_use_id: toolCallId,
      content: result.is_error ? { error: text } : text,
      is_error: result.is_error,
    };
  }

  private convertTool(tool: McpTool): ToolDefinition {
    return {
      name: `${this.namespace}${tool.name}`,
      description: tool.description,
      parameters: tool.input_schema ?? {},
    };
  }

  private isAllowed(name: string): boolean {
    if (this.deny.size > 0 && this.deny.has(name)) return false;
    if (this.allow.size > 0) return this.allow.has(name);
    return true;
  }

  private stripNamespace(namespaced: string): string | null {
    if (namespaced.startsWith(this.namespace)) {
      return namespaced.slice(this.namespace.length);
    }
    return null;
  }
}
