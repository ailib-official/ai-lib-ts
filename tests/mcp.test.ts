/**
 * Tests for MCP module
 */

import { describe, it, expect } from 'vitest';
import { McpToolBridge } from '../src/index.ts';

describe('McpToolBridge', () => {
  it('should convert MCP tools to protocol format', () => {
    const bridge = new McpToolBridge('fileserver');
    const tools = bridge.mcpToolsToProtocol([
      { name: 'read_file', description: 'Read a file', input_schema: { type: 'object' } },
    ]);
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('mcp__fileserver__read_file');
    expect(tools[0].description).toBe('Read a file');
  });

  it('should convert protocol call to MCP invocation', () => {
    const bridge = new McpToolBridge('fileserver');
    const inv = bridge.protocolCallToMcp({
      name: 'mcp__fileserver__read_file',
      arguments: { path: '/tmp/x' },
    });
    expect(inv).not.toBeNull();
    expect(inv!.name).toBe('read_file');
    expect(inv!.arguments?.path).toBe('/tmp/x');
  });

  it('should return null for non-matching call', () => {
    const bridge = new McpToolBridge('fileserver');
    expect(bridge.protocolCallToMcp({ name: 'other_tool' })).toBeNull();
  });

  it('should apply deny filter', () => {
    const bridge = new McpToolBridge('srv', { denyFilter: new Set(['secret']) });
    const tools = bridge.mcpToolsToProtocol([
      { name: 'read' },
      { name: 'secret' },
    ]);
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('mcp__srv__read');
  });
});
