# ai-lib-ts

**Official TypeScript Runtime for AI-Protocol** - The canonical TypeScript/Node.js implementation for unified AI model interaction.

[![npm version](https://img.shields.io/npm/v/@hiddenpath/ai-lib-ts.svg)](https://www.npmjs.com/package/@hiddenpath/ai-lib-ts)
[![Node 18+](https://img.shields.io/badge/node-18+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-green.svg)](LICENSE)

## 🎯 Design Philosophy

`ai-lib-ts` is the official TypeScript runtime implementation for the [AI-Protocol](https://github.com/hiddenpath/ai-protocol) specification. It embodies the core design principle:

> **一切逻辑皆算子，一切配置皆协议** (All logic is operators, all configuration is protocol)

Unlike traditional adapter libraries that hardcode provider-specific logic, `ai-lib-ts` is a **protocol-driven runtime** that executes AI-Protocol specifications. This means:

- **Zero hardcoded provider logic**: All behavior is driven by protocol manifests (YAML/JSON configurations)
- **Operator-based architecture**: Processing is done through composable operators (Decoder → Selector → EventMapper)
- **Unified interface**: Developers interact with a single, consistent API regardless of the underlying provider

## 🚀 Quick Start

### Basic Usage

```typescript
import { AiClient, Message } from '@hiddenpath/ai-lib-ts';

const client = await AiClient.new('openai/gpt-4o');

const response = await client
  .chat([
    Message.system('You are a helpful assistant.'),
    Message.user("Hello! What's 2+2?"),
  ])
  .execute();

console.log(response.content);
// Output: 2+2 equals 4.
```

## ✨ Features

- **Protocol-Driven**: All behavior is driven by YAML/JSON protocol files
- **Unified Interface**: Single API for all AI providers (OpenAI, Anthropic, DeepSeek, etc.)
- **Streaming First**: Native async streaming with `for await`
- **Type Safe**: Full TypeScript types for requests, responses, and errors
- **Production Ready**: Built-in retry, rate limiting, circuit breaker, backpressure, and preflight
- **Extensible**: Easy to add new providers via protocol configuration
- **Multimodal**: Support for text, images (base64/URL), audio, video
- **Token Counting**: Cost estimation and token estimation
- **Request Batching**: BatchExecutor and BatchCollector for parallel execution
- **Model Routing**: ModelManager with Cost/Quality/RoundRobin selectors
- **Embeddings**: EmbeddingClient for vector generation
- **Structured Output**: JSON mode with schema config
- **Response Caching**: MemoryCache with TTL support
- **Plugin System**: PluginRegistry and HookManager
- **Stream Cancellation**: CancelHandle for cancellable streaming
- **MCP Bridge**: McpToolBridge for MCP tools ↔ AI-Protocol format

## 🔄 V2 Protocol Alignment

`ai-lib-ts` aligns with the **AI-Protocol V2** specification. V0.4.0 includes V2 manifest parsing, PreflightChecker, BatchExecutor/BatchCollector, and Pipeline.fromManifest.

### Standard Error Codes (V2)

All provider errors are classified into 13 standard error codes with unified retry/fallback semantics:

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

### Testing with ai-protocol-mock

For integration tests without real API calls, use [ai-protocol-mock](https://github.com/hiddenpath/ai-protocol-mock):

```typescript
import { createClientBuilder } from '@hiddenpath/ai-lib-ts';

// Set environment variable
process.env.MOCK_HTTP_URL = 'http://localhost:4010';

// Or use builder method
const client = await createClientBuilder()
  .withMockServer('http://localhost:4010')
  .build('openai/gpt-4o');
```

## 📦 Installation

```bash
npm install @hiddenpath/ai-lib-ts
# or
yarn add @hiddenpath/ai-lib-ts
# or
pnpm add @hiddenpath/ai-lib-ts
```

## 🔧 Configuration

The library automatically looks for protocol manifests in:

1. `node_modules/ai-protocol/dist` or `node_modules/@hiddenpath/ai-protocol/dist`
2. `../ai-protocol/dist`, `./protocols`
3. GitHub raw `hiddenpath/ai-protocol` (main)

### Provider API Keys

Set API keys via environment variables: `<PROVIDER_ID>_API_KEY`

```bash
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export DEEPSEEK_API_KEY="..."
```

## 🚀 Usage Examples

### Streaming

```typescript
const client = await AiClient.new('anthropic/claude-3-5-sonnet');

const stream = client
  .chat([
    Message.system('You are a helpful assistant.'),
    Message.user('Tell me a short story.'),
  ])
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
import { Tool } from '@hiddenpath/ai-lib-ts';

const weatherTool = Tool.define(
  'get_weather',
  {
    type: 'object',
    properties: {
      location: { type: 'string', description: 'City name' },
      unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
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
    console.log(`Call ${tc.function.name}: ${tc.function.arguments}`);
  }
}
```

### Client Builder with Fallbacks

```typescript
const client = await createClientBuilder()
  .withFallbacks(['anthropic/claude-3-5-sonnet', 'deepseek/deepseek-chat'])
  .withTimeout(30000)
  .build('openai/gpt-4o');
```

### Resilience (Retry, Circuit Breaker, Rate Limiter)

```typescript
import {
  createClientBuilder,
  RetryPolicy,
  CircuitBreaker,
  RateLimiter,
  Backpressure,
} from '@hiddenpath/ai-lib-ts';

const client = await createClientBuilder()
  .withRetry(RetryPolicy.fromConfig({ maxRetries: 5 }))
  .withCircuitBreaker(new CircuitBreaker({ failureThreshold: 5 }))
  .withRateLimiter(RateLimiter.fromRps(10))
  .withBackpressure(new Backpressure({ maxConcurrent: 20 }))
  .build('openai/gpt-4o');
```

### PreflightChecker (Request Gating)

```typescript
import { PreflightChecker, CircuitBreaker, RateLimiter, Backpressure } from '@hiddenpath/ai-lib-ts';

const checker = new PreflightChecker({
  circuitBreaker: new CircuitBreaker(),
  rateLimiter: RateLimiter.fromRps(10),
  backpressure: new Backpressure({ maxConcurrent: 5 }),
});

const result = await checker.check();
if (result.passed) {
  try {
    const response = await client.chat([Message.user('Hi')]).execute();
    checker.onSuccess();
    console.log(response.content);
  } catch (e) {
    checker.onFailure();
    throw e;
  } finally {
    result.release();
  }
}
```

### Batch Processing

```typescript
import { BatchExecutor, batchExecute } from '@hiddenpath/ai-lib-ts';

const op = async (question: string) => {
  const client = await AiClient.new('openai/gpt-4o');
  const r = await client.chat([Message.user(question)]).execute();
  return r.content;
};

const result = await batchExecute(
  ['What is AI?', 'What is Python?', 'What is async?'],
  op,
  { maxConcurrent: 5 }
);

console.log(`Successful: ${result.successfulCount}`);
console.log(`Failed: ${result.failedCount}`);
```

### Token Estimation and Cost

```typescript
import { estimateTokens, estimateCost } from '@hiddenpath/ai-lib-ts';

const tokens = estimateTokens('Hello, how are you?');
console.log(`Tokens: ${tokens}`);

const cost = estimateCost({
  inputTokens: 1000,
  outputTokens: 500,
  model: 'gpt-4o',
});
console.log(`Cost: $${cost.totalCost}`);
```

### Embeddings

```typescript
import { EmbeddingClient } from '@hiddenpath/ai-lib-ts';

const client = await EmbeddingClient.new('openai/text-embedding-3-small');
const response = await client.embed('Hello, world!');
console.log(`Dimensions: ${response.embeddings[0].vector.length}`);
```

### Stream Cancellation

```typescript
const { stream, cancelHandle } = client
  .chat([Message.user('Write a long story...')])
  .stream()
  .executeStreamWithCancel();

// In another task: cancelHandle.cancel()
for await (const event of stream) {
  if (event.event_type === 'PartialContentDelta') {
    process.stdout.write(event.content);
  }
}
```

### Pipeline.fromManifest

```typescript
import { Pipeline, ProtocolLoader } from '@hiddenpath/ai-lib-ts';

const loader = new ProtocolLoader();
const manifest = await loader.load('openai/gpt-4o');
const pipeline = Pipeline.fromManifest(manifest);
const events = pipeline.process(chunk);
```

## Supported Providers

| Provider   | Models        | Streaming | Tools | Vision |
|------------|---------------|-----------|-------|--------|
| OpenAI     | GPT-4o, GPT-4 | ✅        | ✅    | ✅     |
| Anthropic  | Claude 3.5    | ✅        | ✅    | ✅     |
| DeepSeek   | DeepSeek Chat | ✅        | ✅    | ❌     |

## API Reference

### Core Classes

- **`AiClient`**: Main entry point for AI model interaction
- **`Message`**: Chat message with role and content
- **`ContentBlock`**: Multimodal content blocks
- **`Tool`**: Tool/function definition
- **`StreamingEvent`**: Events from streaming responses

### Resilience Classes

- **`RetryPolicy`**: Exponential backoff with jitter
- **`CircuitBreaker`**: Circuit breaker pattern
- **`RateLimiter`**: Token bucket rate limiting
- **`Backpressure`**: Concurrency limiting
- **`PreflightChecker`**: Unified request gating

### Routing Classes

- **`ModelManager`**: Centralized model management
- **`ModelArray`**: Load balancing across endpoints
- **`CostBasedSelector`**, **`QualityBasedSelector`**, **`RoundRobinSelector`**

### Batch Classes

- **`BatchExecutor`**: Parallel execution with concurrency control
- **`BatchCollector`**: Request grouping for batch processing

### Extras

- **`EmbeddingClient`**: Embedding generation
- **`MemoryCache`**: In-memory cache with TTL
- **`SttClient`**, **`TtsClient`**, **`RerankerClient`**: Multimodal extras

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        AiClient                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ ChatBuilder │  │  Resilience │  │    Protocol         │  │
│  │             │  │  (optional) │  │    Loader           │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼───────────────────┼──────────────┘
          │                │                   │
          ▼                ▼                   ▼
┌─────────────────┐ ┌──────────────┐ ┌─────────────────────┐
│   HttpTransport │ │   Pipeline   │ │  ProtocolManifest   │
│   (fetch)       │ │   (decode→   │ │  (YAML/JSON)        │
│                 │ │   select→    │ │                     │
│                 │ │   map)       │ │                     │
└─────────────────┘ └──────────────┘ └─────────────────────┘
```

## 🧪 Development

```bash
git clone https://github.com/hiddenpath/ai-lib-ts.git
cd ai-lib-ts

npm install
npm run build
npm test
```

## Project Structure

```
ai-lib-ts/
├── src/
│   ├── index.ts           # Package exports
│   ├── types/             # Message, ContentBlock, StreamingEvent, Tool
│   ├── protocol/          # Loader, Validator, V2
│   ├── transport/         # HttpTransport
│   ├── pipeline/          # Decoder, Selector, EventMapper
│   ├── client/            # AiClient, ChatBuilder
│   ├── resilience/        # Retry, CircuitBreaker, RateLimiter, Backpressure, PreflightChecker
│   ├── routing/           # ModelManager, ModelArray, Selectors
│   ├── negotiation/        # FallbackChain, firstSuccess, parallelAll
│   ├── embeddings/        # EmbeddingClient
│   ├── cache/             # MemoryCache
│   ├── batch/             # BatchExecutor, BatchCollector
│   ├── stt/               # SttClient
│   ├── tts/               # TtsClient
│   ├── rerank/            # RerankerClient
│   ├── plugins/           # PluginRegistry, HookManager
│   ├── mcp/               # McpToolBridge
│   └── errors/            # Standard error codes
├── tests/
└── package.json
```

## 📖 Related Projects

- [AI-Protocol](https://github.com/hiddenpath/ai-protocol) - Protocol specification (v1.5 / V2)
- [ai-lib-python](https://github.com/hiddenpath/ai-lib-python) - Python runtime implementation
- [ai-lib-rust](https://github.com/hiddenpath/ai-lib-rust) - Rust runtime implementation
- [ai-protocol-mock](https://github.com/hiddenpath/ai-protocol-mock) - Unified mock server

## 📄 License

This project is licensed under either of:

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE) or http://www.apache.org/licenses/LICENSE-2.0)
- MIT License ([LICENSE-MIT](LICENSE-MIT) or http://opensource.org/licenses/MIT)

at your option.

---

**ai-lib-ts** - Where protocol meets TypeScript. 📘✨
