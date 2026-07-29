# ai-lib-ts

**[AI-Protocol](https://github.com/ailib-official/ai-protocol) 协议运行时** — TypeScript / Node.js 参考实现（v**1.0.1**）。

[English](README.md)

`@ailib-official/ai-lib-ts` 提供三个入口：

| 导入 | 层 | 适用场景 |
|------|----|----------|
| `@ailib-official/ai-lib-ts` | E + P 门面 | 完整 SDK（默认） |
| `@ailib-official/ai-lib-ts/core` | 仅执行层 | Edge / 精简打包 — 无弹性路由 |
| `@ailib-official/ai-lib-ts/contact` | 仅策略层 | 重试、熔断、路由 — 无 `AiClient` |

已发布到 [npm](https://www.npmjs.com/package/@ailib-official/ai-lib-ts)：**`@ailib-official/ai-lib-ts@1.0.1`**。可选 peer：`@ailib-official/ai-protocol@^1.0.0`。

> **说明：** Git `main` 可能包含上次 npm 发版之后的协议身份解析与 Experimental Envelope 改动。依赖请对齐目标 tag；见 [CHANGELOG](CHANGELOG.md) 的 `Unreleased`。

## 工作原理

**默认聊天路径：** `AiClient` 加载 provider manifest → 按 manifest 字段构建请求 → 经 **P 层 `HttpTransport`**（始终启用 retry）发 HTTP → 用 manifest `response_paths` 与 OpenAI 风格回退解析 JSON / SSE。

这**不是**底层 `Pipeline` 算子路径（该 API 仍用于合规 / 高级场景，但 `AiClient` **不会**对聊天调用 `Pipeline.process()`）。本运行时**没有** `ProviderDriver`。

| 层 | 模块 | 职责 |
|----|------|------|
| 执行 (E) | `client`、`protocol`、`transport/http`、`pipeline`、`types`、`structured`、`mcp`、embeddings/STT/TTS/rerank | HTTP、解析、类型 |
| 策略 (P) | `resilience`、`routing`、`cache`、`batch`、`telemetry`、`guardrails`、`transport`（包装） | 重试、限流、路由 — 默认传输上部分自动启用 |
| 门面 | 包根 | 再导出两层 |

## 快速开始

```bash
npm install @ailib-official/ai-lib-ts
export OPENAI_API_KEY="your-key"
```

```typescript
import { AiClient, Message } from '@ailib-official/ai-lib-ts';

const client = await AiClient.new('openai/gpt-4o');

const response = await client
  .chat([
    Message.system('你是一个乐于助人的助手。'),
    Message.user('你好！'),
  ])
  .execute();

console.log(response.content);
```

### Mock 服务（集成测试）

```typescript
import { Message, createClientBuilder } from '@ailib-official/ai-lib-ts';

const client = await createClientBuilder()
  .withMockServer('http://localhost:4010')
  .build('openai/gpt-4o');

const response = await client
  .chat([Message.user('你好！')])
  .execute();
```

需要运行中的 [ai-protocol-mock](https://github.com/ailib-official/ai-protocol-mock)。基于环境变量的 mock URL 覆盖（`MOCK_HTTP_URL`）仅在 `AILIB_ALLOW_MOCK_URL=1` 或 `NODE_ENV=test` 时由传输层生效。显式 `withMockServer` / `baseUrlOverride` 始终优先。

示例来源：`tests/integration.test.ts`。

### 流式

```typescript
const stream = client
  .chat([Message.user('从 1 数到 5')])
  .stream()
  .executeStream();

for await (const event of stream) {
  if (event.event_type === 'PartialContentDelta') {
    process.stdout.write(event.content);
  }
}
```

### 工具调用

```typescript
const response = await client
  .chat([Message.user('东京天气怎么样？')])
  .tools([
    {
      name: 'get_weather',
      description: '获取天气',
      parameters: {
        type: 'object',
        properties: { city: { type: 'string' } },
        required: ['city'],
      },
    },
  ])
  .execute();

for (const call of response.toolCalls ?? []) {
  console.log(call.name, call.arguments);
}
```

## 公共 API（包根）

主要导出：

- **客户端：** `AiClient`、`AiClientBuilder`、`createClient`、`createClientBuilder`、`ChatBuilder`
- **类型：** `Message`、`ContentBlock`、`StreamingEvent`、`Tool`、执行元数据类型
- **错误：** `AiLibError`、`StandardErrorCode`、`isRetryable`、`isFallbackable`
- **协议：** `ProtocolLoader`、manifest 类型、V2 解析器、内容块编码器
- **Pipeline（高级）：** `Pipeline`、`createPipeline` — 未接入默认 `AiClient`
- **策略：** `RetryPolicy`、`CircuitBreaker`、`RateLimiter`、`Backpressure`、`ModelManager`、`FallbackChain`、…
- **服务客户端：** `EmbeddingClient`、`RerankerClient`、`SttClient`、`TtsClient`（独立 HTTP；非聊天 Pipeline）
- **扩展：** `MemoryCache`、`McpToolBridge`、`Guardrails`、遥测助手

需要仅 E 层时用 `/core`（传输上无 `RetryPolicy`）。仅策略、不要 `AiClient` 时用 `/contact`。

文本工具助手（`StandardTextToolParser`、`createToolCallingPolicy` 等）在 `types` 中，并由 **`@ailib-official/ai-lib-ts/core`** 再导出（不在包根 barrel）。

### 能力边界（如实说明）

| 领域 | 包内已有 | 不包含 |
|------|----------|--------|
| **MCP** | `McpToolBridge` 格式转换 | `AiClient` 内的 MCP 服务端传输 |
| **Computer Use** | 协议模块中的 V2 配置类型 | 运行时执行器 / 截图环境 |
| **热重载** | — | 未实现（仅有 `ProtocolLoader.clearCache()`） |
| **默认客户端弹性** | P 层 `HttpTransport` 上的 manifest **retry** | 除非传入 `resilience`，否则无熔断 / 限流 / 背压 |
| **`Pipeline`** | 公开底层 API | 默认 `AiClient` 聊天路径 |
| **Embeddings / rerank** | `fromManifest` / `fromModel` 的协议化构建 | 静默 OpenAI/Cohere 主机默认（已移除；ALT-EMB-001） |
| **Experimental Envelope** | 解析 / 校验 / fixture 加载（ALT-EXP-001） | 分层拼装算法（以 rust `assemble_layered` 为准） |

### Embeddings 与 rerank（ALT-EMB-001）

无静默厂商 base URL。优先使用协议构建器：

```typescript
import { EmbeddingClient } from '@ailib-official/ai-lib-ts';

const client = await EmbeddingClient.builder().fromModel('openai/text-embedding-3-small');
const result = await client.embed('hello');
```

`fromManifest` / `fromModel` 从 manifest 解析凭证、`base_url` 与端点路径（路径仅回退 `/embeddings` 或 `/rerank`）。仍可显式覆盖 `baseUrl` / `apiKey`。

### 弹性（默认启用项）

默认 `AiClient` 使用 P 层 `HttpTransport`，非流式 `execute()` **始终**应用 manifest/默认 **retry**。

熔断、限流、背压需在构造传输时显式传入 `TransportOptions.resilience` — `AiClientBuilder` **没有** `.withCircuitBreaker()` / `.withRateLimiter()` 助手。

手动门控可用策略层的 `PreflightChecker`，放在客户端旁侧使用。

## 协议清单

经 `ProtocolLoader` / `AiClient.new(model, { protocolPath })` 解析：

1. 显式 `protocolPath`（仅权威根）
2. `AI_PROTOCOL_DIR` / `AI_PROTOCOL_PATH`（权威）+ 打包降级路径
3. 打包 / 相对默认（`node_modules/@ailib-official/ai-protocol`、`../ai-protocol`、…）
4. GitHub raw 回退（`ailib-official/ai-protocol` 的 `main` `dist/`）

每个根：优先已发布的 `dist/v2|v1/providers/<id>.json`，再降级到源 YAML/JSON。

**身份 / 别名（`main` 上 Unreleased，ALT-ID-001）：** `loadProvider` 通过 `dist/provider-identity.json`（多家族映射）解析市场别名，例如 `google` → `gemini`、`kimi` → `moonshot`。顺序：权威根精确匹配 → 别名 → 重试 → 降级 → GitHub dist；否则失败关闭。

**Experimental Envelope（`main` 上 Unreleased，ALT-EXP-001）：** `parseContextEnvelope` / `parseCapabilityTagMapping`（及 fixture 加载器、schema 版本常量）。状态仍为 `experimental` — 不是产品路由默认。TS 不重实现分层拼装。

## API 密钥

1. 显式传输 / builder 凭证覆盖
2. Manifest 声明的环境变量（`endpoint.auth` / 顶层 `auth`：`token_env` / `key_env` / …）
3. 约定式 `<PROVIDER_ID>_API_KEY` 环境变量

## 标准错误码（V2）

| 错误码 | 名称 | 可重试 | 可回退 |
|--------|------|--------|--------|
| E1001 | `invalid_request` | 否 | 否 |
| E1002 | `authentication` | 否 | 是 |
| E1003 | `permission_denied` | 否 | 否 |
| E1004 | `not_found` | 否 | 否 |
| E1005 | `request_too_large` | 否 | 否 |
| E2001 | `rate_limited` | 是 | 是 |
| E2002 | `quota_exhausted` | 否 | 是 |
| E3001 | `server_error` | 是 | 是 |
| E3002 | `overloaded` | 是 | 是 |
| E3003 | `timeout` | 是 | 是 |
| E4001 | `conflict` | 是 | 否 |
| E4002 | `cancelled` | 否 | 否 |
| E9999 | `unknown` | 否 | 否 |

## 测试

```bash
npm test
npm run test:core
npm run test:compliance:full
```

配合 mock 服务：

```bash
AILIB_ALLOW_MOCK_URL=1 MOCK_HTTP_URL=http://localhost:4010 npm test
```

合规（本地协议检出）：

```bash
AI_PROTOCOL_DIR=../ai-protocol COMPLIANCE_DIR=../ai-protocol/tests/compliance npm test
```

## 相关项目

- [AI-Protocol](https://github.com/ailib-official/ai-protocol) — 规范与清单
- [ai-lib-rust](https://github.com/ailib-official/ai-lib-rust) — Rust 运行时
- [ai-lib-python](https://github.com/ailib-official/ai-lib-python) — Python 运行时
- [ai-lib-go](https://github.com/ailib-official/ai-lib-go) — Go 运行时
- [ai-protocol-mock](https://github.com/ailib-official/ai-protocol-mock) — 统一 mock 服务

## 许可证

双许可：[Apache-2.0](LICENSE-APACHE) 或 [MIT](LICENSE-MIT)。
