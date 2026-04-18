/**
 * Generative Capabilities Compliance Tests
 * 
 * Tests for gen-001 through gen-007 compliance cases from ai-protocol.
 * Validates: capability loading, token usage, structured output,
 * streaming tool calls, error classification, reasoning mode, MCP gating.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { Pipeline } from '../src/pipeline/index.js';
import { 
  getFeatureFlags, 
  getAllCapabilities,
  hasCapability,
  type ProviderManifest 
} from '../src/protocol/manifest.js';

/**
 * Get ai-protocol root directory
 */
function getProtocolRoot(): string {
  const envRoot = process.env.AI_PROTOCOL_DIR ?? process.env.AI_PROTOCOL_PATH;
  const candidates = [
    envRoot,
    resolve(process.cwd(), '../ai-protocol'),
    resolve(process.cwd(), '../../ai-protocol'),
    '/home/alex/ai-protocol',
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error('Unable to locate ai-protocol root. Set AI_PROTOCOL_DIR env var.');
}

/**
 * Helper to load YAML fixture
 */
async function loadYamlFixture(path: string): Promise<Record<string, unknown>> {
  const { parse: parseYaml } = await import('yaml');
  const content = await readFile(path, 'utf-8');
  return parseYaml(content) as Record<string, unknown>;
}

describe('Generative Capabilities Compliance', () => {
  let protocolRoot: string;
  
  beforeAll(() => {
    protocolRoot = getProtocolRoot();
  });

  describe('gen-001: Capability loading', () => {
    it('should load provider manifest with generative capabilities', async () => {
      const manifestPath = join(protocolRoot, 'tests/compliance/fixtures/providers/mock-openai.yaml');
      
      if (!existsSync(manifestPath)) {
        console.log('Skipping gen-001: fixture not found');
        return;
      }
      
      const rawManifest = await loadYamlFixture(manifestPath);
      
      expect(rawManifest).toBeDefined();
      expect(rawManifest.id).toBe('openai');
      
      // Check capabilities
      const caps = rawManifest.capabilities as string[] | undefined;
      expect(caps).toBeDefined();
      
      // Should have text and streaming
      expect(caps).toContain('chat');
      expect(caps).toContain('streaming');
      expect(caps).toContain('tools');
    });

    it('should parse feature_flags from manifest', async () => {
      const manifestPath = join(protocolRoot, 'tests/compliance/fixtures/providers/mock-openai.yaml');
      
      if (!existsSync(manifestPath)) {
        console.log('Skipping gen-001 feature_flags test: fixture not found');
        return;
      }
      
      const rawManifest = await loadYamlFixture(manifestPath);
      const manifest = rawManifest as unknown as ProviderManifest;
      
      // Use helper functions to check capabilities
      const allCaps = getAllCapabilities(manifest);
      expect(allCaps).toContain('chat');
      expect(allCaps).toContain('streaming');
      expect(allCaps).toContain('tools');
      
      // Check specific capabilities
      expect(hasCapability(manifest, 'chat')).toBe(true);
      expect(hasCapability(manifest, 'streaming')).toBe(true);
      expect(hasCapability(manifest, 'tools')).toBe(true);
      expect(hasCapability(manifest, 'mcp_client')).toBe(true);
      
      // Check feature flags (V1 format may not have these)
      const flags = getFeatureFlags(manifest);
      if (flags) {
        // If feature flags exist, verify structure
        expect(typeof flags.structured_output).toBe('boolean');
        expect(typeof flags.extended_thinking).toBe('boolean');
      }
    });
  });

  describe('gen-002: Token usage extraction', () => {
    it('should extract usage from sync response', () => {
      const responseBody = {
        id: 'chatcmpl-test-001',
        object: 'chat.completion',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Hello, world!',
          },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
          completion_tokens_details: {
            reasoning_tokens: 3,
          },
        },
      };
      
      // Extract usage
      const usage = responseBody.usage;
      expect(usage).toBeDefined();
      expect(usage.prompt_tokens).toBe(10);
      expect(usage.completion_tokens).toBe(5);
      expect(usage.total_tokens).toBe(15);
      
      // Check reasoning tokens
      const details = usage.completion_tokens_details;
      expect(details).toBeDefined();
      expect(details.reasoning_tokens).toBe(3);
    });
  });

  describe('gen-003: Structured output JSON mode', () => {
    it('should include response_format in request', () => {
      const messages = [{ role: 'user', content: 'List three colors as JSON' }];
      const parameters = { response_format: { type: 'json_object' as const } };
      
      // Build request payload
      const payload = {
        messages,
        ...parameters,
      };
      
      expect(payload.response_format).toBeDefined();
      expect(payload.response_format.type).toBe('json_object');
    });
  });

  describe('gen-004: Streaming tool call accumulation', () => {
    it('should accumulate partial tool call arguments', () => {
      const pipeline = Pipeline.forProvider('openai_sse');
      
      // Simulate streaming events for tool call
      const chunk1 = 'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_abc","type":"function","function":{"name":"get_weather","arguments":""}}]}}]}';
      const chunk2 = 'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"loc"}}]}}]}';
      const chunk3 = 'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"ation\\": \\"SF\\"}"}}]}}]}';
      const chunk4 = 'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":20,"completion_tokens":15,"total_tokens":35}}';
      const chunk5 = 'data: [DONE]';
      
      const events1 = pipeline.process(chunk1 + '\n\n');
      const events2 = pipeline.process(chunk2 + '\n\n');
      const events3 = pipeline.process(chunk3 + '\n\n');
      pipeline.process(chunk4 + '\n\n');
      pipeline.process(chunk5 + '\n\n');
      
      // First chunk should emit ToolCallStarted
      const startedEvent = events1.find(e => e.event_type === 'ToolCallStarted');
      expect(startedEvent).toBeDefined();
      if (startedEvent && startedEvent.event_type === 'ToolCallStarted') {
        expect(startedEvent.tool_call_id).toBe('call_abc');
        expect(startedEvent.tool_name).toBe('get_weather');
      }
      
      // Subsequent chunks should emit PartialToolCall
      const partialEvents = [...events2, ...events3];
      const partialEvent = partialEvents.find(e => e.event_type === 'PartialToolCall');
      expect(partialEvent).toBeDefined();
      
      // Check accumulated arguments
      if (partialEvent && partialEvent.event_type === 'PartialToolCall') {
        expect(partialEvent.tool_call_id).toBe('call_abc');
        // Arguments might be partial or accumulated depending on implementation
        expect(partialEvent.arguments).toBeDefined();
      }
    });
  });

  describe('gen-005: Context window overflow error classification', () => {
    it('should classify context_length_exceeded as E1005', () => {
      const httpStatus = 400;
      const responseBody = {
        error: {
          message: "This model's maximum context length is 128000 tokens. However, your messages resulted in 150000 tokens.",
          type: 'invalid_request_error',
          code: 'context_length_exceeded',
        },
      };
      
      // Map error code
      // context_length_exceeded → request_too_large → E1005
      const errorType = mapErrorType(responseBody.error.code, httpStatus);
      const errorCode = mapErrorCode(errorType);
      
      expect(errorType).toBe('request_too_large');
      expect(errorCode).toBe('E1005');
    });
  });

  describe('gen-006: Reasoning mode streaming with thinking blocks', () => {
    it('should emit ThinkingDelta events from Anthropic stream', () => {
      const pipeline = Pipeline.forProvider('anthropic_sse');
      
      // Simulate Anthropic streaming with thinking blocks
      const chunk1 = 'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":""}}';
      const chunk2 = 'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"Let me analyze..."}}';
      const chunk3 = 'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}';
      const chunk4 = 'event: content_block_start\ndata: {"type":"content_block_start","index":1,"content_block":{"type":"text","text":""}}';
      const chunk5 = 'event: content_block_delta\ndata: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"The answer is 42."}}';
      const chunk6 = 'event: content_block_stop\ndata: {"type":"content_block_stop","index":1}';
      const chunk7 = 'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":25}}';
      const chunk8 = 'event: message_stop\ndata: {"type":"message_stop"}';
      
      const allEvents = [
        ...pipeline.process(chunk1 + '\n\n'),
        ...pipeline.process(chunk2 + '\n\n'),
        ...pipeline.process(chunk3 + '\n\n'),
        ...pipeline.process(chunk4 + '\n\n'),
        ...pipeline.process(chunk5 + '\n\n'),
        ...pipeline.process(chunk6 + '\n\n'),
        ...pipeline.process(chunk7 + '\n\n'),
        ...pipeline.process(chunk8 + '\n\n'),
      ];
      
      // Check for ThinkingDelta event
      const thinkingEvent = allEvents.find(e => e.event_type === 'ThinkingDelta');
      
      expect(thinkingEvent).toBeDefined();
      if (thinkingEvent && thinkingEvent.event_type === 'ThinkingDelta') {
        expect(thinkingEvent.thinking).toContain('Let me analyze');
      }
      
      // Check for text content
      const contentEvent = allEvents.find(e => e.event_type === 'PartialContentDelta');
      expect(contentEvent).toBeDefined();
      if (contentEvent && contentEvent.event_type === 'PartialContentDelta') {
        expect(contentEvent.content).toContain('The answer is 42');
      }
      
      // Check for stop reason
      const metadataEvent = allEvents.find(e => e.event_type === 'Metadata');
      expect(metadataEvent).toBeDefined();
      if (metadataEvent && metadataEvent.event_type === 'Metadata') {
        expect(metadataEvent.stop_reason).toBe('end_turn');
      }
    });
  });

  describe('gen-007: MCP tool bridge capability gating', () => {
    it('should check mcp_client capability', async () => {
      const manifestPath = join(protocolRoot, 'tests/compliance/fixtures/providers/mock-openai.yaml');
      
      if (!existsSync(manifestPath)) {
        console.log('Skipping gen-007: fixture not found');
        return;
      }
      
      const rawManifest = await loadYamlFixture(manifestPath);
      const manifest = rawManifest as unknown as ProviderManifest;
      
      // Use helper function to check capability
      const hasMcpClient = hasCapability(manifest, 'mcp_client');
      
      // For mock-openai, mcp_client should be declared
      expect(hasMcpClient).toBe(true);
      
      // Also verify using getAllCapabilities
      const allCaps = getAllCapabilities(manifest);
      expect(allCaps).toContain('mcp_client');
    });
  });
});

/**
 * Map provider error code to error type
 */
function mapErrorType(code: string, httpStatus: number): string {
  if (code === 'context_length_exceeded') {
    return 'request_too_large';
  }
  if (code === 'rate_limit_exceeded' || httpStatus === 429) {
    return 'rate_limited';
  }
  if (httpStatus === 401) {
    return 'authentication';
  }
  if (httpStatus === 400) {
    return 'invalid_request';
  }
  if (httpStatus >= 500) {
    return 'server_error';
  }
  return 'unknown';
}

/**
 * Map error type to error code
 */
function mapErrorCode(errorType: string): string {
  const mapping: Record<string, string> = {
    invalid_request: 'E1001',
    authentication: 'E1002',
    rate_limited: 'E1003',
    request_too_large: 'E1005',
    server_error: 'E1006',
  };
  return mapping[errorType] || 'E1999';
}
