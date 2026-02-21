# ai-lib-ts

**AI-Protocol TypeScript Runtime** - Official TypeScript/Node.js implementation for unified AI model interaction.

`ai-lib-ts` is the official TypeScript runtime for [AI-Protocol](https://github.com/hiddenpath/ai-protocol), providing a unified interface for interacting with AI models across different providers without hardcoding provider-specific logic.

## 🎯 Design Philosophy

- **Protocol-Driven**: All behavior is configured through protocol manifests, not code
- **Provider-Agnostic**: Unified interface across OpenAI, Anthropic, Google, DeepSeek, and 30+ providers
- **Streaming-First**: Native support for Server-Sent Events (SSE) streaming
- **Type-Safe**: Strongly typed request/response handling with comprehensive error types

## 📦 Installation

```bash
npm install @hiddenpath/ai-lib-ts

# or
yarn add @hiddenpath/ai-lib-ts

# or
pnpm add @hiddenpath/ai-lib-ts
```

## 🚀 Quick Start

### Basic Usage

```typescript
import { AiClient, Message } from '@hiddenpath/ai-lib-ts';

// Create a client for a specific model
const client = await AiClient.new('deepseek/deepseek-chat');

// Send a chat request
const response = await client
  .chat([
    Message.system('You are a helpful assistant.'),
    Message.user('Hello!'),
  ])
  .temperature(0.7)
  .maxTokens(500)
  .execute();

console.log(response.content);
console.log(response.usage);
```

### Streaming Responses

```typescript
import { AiClient, Message } from '@hiddenpath/ai-lib-ts';

const client = await AiClient.new('openai/gpt-4o');

// Stream the response
const stream = client
  .chat([Message.user('Tell me a story')])
  .stream()
  .executeStream();

for await (const event of stream) {
  if (event.event_type === 'PartialContentDelta') {
    process.stdout.write(event.content);
  }
}
```

### Tool Calling

```typescript
import { AiClient, Message, Tool } from '@hiddenpath/ai-lib-ts';

const client = await AiClient.new('anthropic/claude-3-5-sonnet');

const weatherTool = Tool.define(
  'get_weather',
  {
    type: 'object',
    properties: {
      location: { type: 'string' },
    },
    required: ['location'],
  },
  'Get current weather for a location'
);

const response = await client
  .chat([Message.user("What's the weather in Tokyo?")])
  .tools([weatherTool])
  .execute();

if (response.toolCalls) {
  for (const tc of response.toolCalls) {
    console.log(`Tool: ${tc.function.name}`);
    console.log(`Args: ${tc.function.arguments}`);
  }
}
```

### Client Builder

```typescript
import { createClientBuilder, MOCK_SERVER_URL } from '@hiddenpath/ai-lib-ts';

// For testing with mock server (default: http://192.168.2.13:4010)
const client = await createClientBuilder()
  .withMockServer() // or .withMockServer('http://your-mock:4010')
  .withTimeout(30000)
  .build('openai/gpt-4o');

// With fallback models
const clientWithFallbacks = await createClientBuilder()
  .withFallbacks(['anthropic/claude-3-5-sonnet', 'deepseek/deepseek-chat'])
  .build('openai/gpt-4o');
```

## 🏗️ Architecture

### Protocol Layer (`protocol/`)
- **Loader**: Load protocol manifests from local files, npm packages, or remote URLs
- **Validator**: Validate manifests against JSON Schema
- **Manifest**: Strongly typed protocol configuration structures
- **V2**: ManifestV2 types, parseManifestV2, loadManifestV2FromUrl

### Transport Layer (`transport/`)
- **HttpTransport**: HTTP client with retry, timeout, and streaming support
- **Resilience**: RetryPolicy, CircuitBreaker, RateLimiter, Backpressure (injectable)
- Native `fetch` API for maximum compatibility

### Pipeline Layer (`pipeline/`)
- **Decoder**: Parse raw bytes to SSE frames
- **Selector**: Filter frames based on conditions
- **EventMapper**: Transform provider frames to unified events

### Client Layer (`client/`)
- **AiClient**: Main entry point for AI interactions
- **AiClientBuilder**: Configure clients with custom options
- **ChatBuilder**: Fluent API for building chat requests
- **CancelHandle**: executeStreamWithCancel() for cancellable streaming

### Extended Modules (v0.3.0+)
- **Resilience**: RetryPolicy, CircuitBreaker, RateLimiter, Backpressure
- **Routing**: ModelManager, CostBasedSelector, QualityBasedSelector, ModelArray
- **Negotiation**: FallbackChain, firstSuccess, parallelAll
- **Multimodal**: SttClient, TtsClient, RerankerClient; ContentBlock (video, omni)
- **Extras**: EmbeddingClient, MemoryCache, jsonObjectConfig, estimateTokens
- **Plugins**: PluginRegistry, HookManager
- **MCP**: McpToolBridge (MCP tools ↔ AI-Protocol format)

## 📋 Standard Error Codes (V2)

All provider errors are classified into 13 standard error codes:

| Code   | Name             | Retryable | Fallbackable |
|--------|------------------|-----------|--------------|
| E1001  | invalid_request  | No        | No           |
| E1002  | authentication   | No        | Yes          |
| E1003  | permission_denied| No        | No           |
| E1004  | not_found        | No        | No           |
| E1005  | request_too_large| No        | No           |
| E2001  | rate_limited     | Yes       | Yes          |
| E2002  | quota_exhausted  | No        | Yes          |
| E3001  | server_error     | Yes       | Yes          |
| E3002  | overloaded       | Yes       | Yes          |
| E3003  | timeout          | Yes       | Yes          |
| E4001  | conflict         | Yes       | No           |
| E4002  | cancelled        | No        | No           |
| E9999  | unknown          | No        | No           |

## 🧪 Testing with Mock Server

Use [ai-protocol-mock](https://github.com/hiddenpath/ai-protocol-mock) for testing without real API calls:

```typescript
import { createClientBuilder } from '@hiddenpath/ai-lib-ts';

// Set environment variable
process.env.MOCK_HTTP_URL = 'http://192.168.2.13:4010';

// Or use builder method
const client = await createClientBuilder()
  .withMockServer('http://192.168.2.13:4010')
  .build('openai/gpt-4o');
```

## 📚 API Reference

### Types

```typescript
// Message types
interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentBlock[];
}

// Streaming events
type StreamingEvent =
  | { event_type: 'PartialContentDelta'; content: string }
  | { event_type: 'ToolCallStarted'; tool_call_id: string; tool_name: string }
  | { event_type: 'StreamEnd'; finish_reason?: string }
  // ... more event types

// Tool types
interface ToolDefinition {
  name: string;
  description?: string;
  parameters: unknown;
  strict?: boolean;
}
```

### Client

```typescript
// Create client
const client = await AiClient.new('provider/model-name');

// Chat request
const response = await client
  .chat(messages)
  .temperature(0.7)
  .maxTokens(1000)
  .tools([...])
  .execute();

// Streaming
const stream = client.chat(messages).stream().executeStream();
for await (const event of stream) {
  // Handle events
}
```

## 🔗 Related Projects

- [AI-Protocol](https://github.com/hiddenpath/ai-protocol) - Provider-agnostic specification
- [ai-lib-rust](https://github.com/hiddenpath/ai-lib-rust) - Rust runtime implementation
- [ai-lib-python](https://github.com/hiddenpath/ai-lib-python) - Python runtime implementation
- [ai-protocol-mock](https://github.com/hiddenpath/ai-protocol-mock) - Unified mock server

## 📄 License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE) or http://www.apache.org/licenses/LICENSE-2.0)
- MIT license ([LICENSE-MIT](LICENSE-MIT) or http://opensource.org/licenses/MIT)

at your option.

### Contribution

Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in the work by you shall be dual licensed as above, without any additional terms or conditions.
