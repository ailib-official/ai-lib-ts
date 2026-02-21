/**
 * MCP (Model Context Protocol) types.
 * Aligned with ai-lib-python mcp module.
 */

export interface McpTool {
  name: string;
  description?: string;
  input_schema?: Record<string, unknown>;
}

export interface McpToolInvocation {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface McpToolResult {
  content?: Array<{ type?: string; text?: string }>;
  is_error?: boolean;
}

export interface McpServerSpec {
  name: string;
  transport: string;
  uri: string;
  auth?: Record<string, unknown>;
}
