/**
 * Integration tests using ai-protocol-mock.
 *
 * Set MOCK_HTTP_URL to run these tests against a reachable mock server.
 *
 * Run tests: MOCK_HTTP_URL=http://localhost:4010 npm test
 */

import { describe, it, expect } from 'vitest';
import { Message, createClientBuilder } from '../src/index.ts';

// Use mock server for testing
const mockServerUrl = process.env.MOCK_HTTP_URL ?? 'http://localhost:4010';
const mockAvailable = await fetch(`${mockServerUrl.replace(/\/$/, '')}/health`)
  .then((response) => response.ok)
  .catch(() => false);

describe.skipIf(!mockAvailable)('Client Integration Tests', () => {
  describe('AiClient', () => {
    it('should create client with mock server', async () => {
      const client = await createClientBuilder()
        .withMockServer(mockServerUrl)
        .build('openai/gpt-4o');

      expect(client).toBeDefined();
      expect(client.model).toBe('gpt-4o');
    });

    it('should send chat request and get response', async () => {
      const client = await createClientBuilder()
        .withMockServer(mockServerUrl)
        .withTimeout(10000)
        .build('openai/gpt-4o');

      const response = await client
        .chat([
          Message.system('You are a helpful assistant.'),
          Message.user('Hello!'),
        ])
        .maxTokens(100)
        .execute();

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(typeof response.content).toBe('string');
    }, 15000);

    it('should stream chat response', async () => {
      const client = await createClientBuilder()
        .withMockServer(mockServerUrl)
        .withTimeout(30000)
        .build('openai/gpt-4o');

      const stream = client
        .chat([Message.user('Count from 1 to 5')])
        .stream()
        .executeStream();

      const events: unknown[] = [];

      for await (const event of stream) {
        events.push(event);
      }

      // Should have at least some content events
      const contentEvents = events.filter(
        (e) => (e as { event_type?: string }).event_type === 'PartialContentDelta'
      );
      expect(contentEvents.length).toBeGreaterThan(0);
    }, 35000);

    it('should handle tool calling', async () => {
      const client = await createClientBuilder()
        .withMockServer(mockServerUrl)
        .build('anthropic/claude-3-5-sonnet');

      const weatherTool = {
        name: 'get_weather',
        description: 'Get weather',
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string' },
          },
        },
      };

      const response = await client
        .chat([Message.user("What's the weather in Tokyo?")])
        .tools([weatherTool])
        .execute();

      expect(response).toBeDefined();
    }, 15000);
  });

  describe('Multiple providers', () => {
    it('should work with DeepSeek', async () => {
      const client = await createClientBuilder()
        .withMockServer(mockServerUrl)
        .build('deepseek/deepseek-chat');

      expect(client.provider).toBe('deepseek');
    });

    it('should work with Anthropic', async () => {
      const client = await createClientBuilder()
        .withMockServer(mockServerUrl)
        .build('anthropic/claude-3-5-sonnet');

      expect(client.provider).toBe('anthropic');
    });
  });
});
