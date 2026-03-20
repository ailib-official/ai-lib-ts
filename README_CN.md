# ai-lib-ts

**AI-Protocol 官方 TypeScript 运行时** - 统一 AI 模型交互的规范 TypeScript/Node.js 实现。

[![npm version](https://img.shields.io/npm/v/@hiddenpath/ai-lib-ts.svg)](https://www.npmjs.com/package/@hiddenpath/ai-lib-ts)
[![Node 18+](https://img.shields.io/badge/node-18+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-green.svg)](LICENSE)

## 🎯 设计理念

`ai-lib-ts` 是 [AI-Protocol](https://github.com/ailib-official/ai-protocol) 规范的**官方 TypeScript 运行时**。它体现了核心设计原则：

> **一切逻辑皆算子，一切配置皆协议** (All logic is operators, all configuration is protocol)

与传统的适配器库硬编码特定提供商逻辑不同，`ai-lib-ts` 是一个**协议驱动的运行时**，执行 AI-Protocol 规范。这意味着：

- **零硬编码提供商逻辑**: 所有行为都由协议清单（YAML/JSON 配置）驱动
- **基于算子的架构**: 通过可组合的算子（Decoder → Selector → EventMapper）进行处理
- **统一接口**: 开发者与单一、一致的 API 交互，无论底层提供商是什么

## 🚀 快速入门

### 基础用法

```typescript
import { AiClient, Message } from '@hiddenpath/ai-lib-ts';

const client = await AiClient.new('openai/gpt-4o');

const response = await client
  .chat([
    Message.system('你是一个乐于助人的助手。'),
    Message.user('你好！2+2 等于多少？'),
  ])
  .execute();

console.log(response.content);
// 输出: 2+2 等于 4。
```

## ✨ 特性

- **协议驱动**: 所有行为由 YAML/JSON 协议文件驱动
- **统一接口**: 单一 API 支持所有 AI 提供商（OpenAI、Anthropic、DeepSeek 等）
- **流式优先**: 原生 async 流式处理，使用 `for await`
- **类型安全**: 完整的 TypeScript 类型
- **生产就绪**: 内置重试、限流、熔断、背压和预检
- **易于扩展**: 通过协议配置轻松添加新提供商
- **多模态支持**: 支持文本、图像（base64/URL）、音频、视频
- **Token 计数**: 成本估算和 token 估算
- **批处理**: BatchExecutor 和 BatchCollector 并行执行
- **模型路由**: ModelManager 与 Cost/Quality/RoundRobin 选择器
- **向量嵌入**: EmbeddingClient 向量生成
- **结构化输出**: JSON 模式与 schema 配置
- **响应缓存**: MemoryCache 带 TTL 支持
- **插件系统**: PluginRegistry 和 HookManager
- **流式取消**: CancelHandle 可取消流式
- **MCP 桥接**: McpToolBridge（MCP 工具 ↔ AI-Protocol 格式）

## 🔄 V2 协议对齐

`ai-lib-ts` 与 **AI-Protocol V2** 规范对齐。V0.4.0 包含 V2 manifest 解析、PreflightChecker、BatchExecutor/BatchCollector、Pipeline.fromManifest。

### 标准错误码（V2）

所有 provider 错误被分类为 13 个标准错误码，具有统一的重试/回退语义：

| 错误码 | 名称             | 可重试 | 可回退 |
|--------|------------------|--------|--------|
| E1001  | invalid_request  | 否     | 否     |
| E1002  | authentication   | 否     | 是     |
| E1003  | permission_denied| 否     | 否     |
| E1004  | not_found        | 否     | 否     |
| E1005  | request_too_large| 否     | 否     |
| E2001  | rate_limited     | 是     | 是     |
| E2002  | quota_exhausted  | 否     | 是     |
| E3001  | server_error     | 是     | 是     |
| E3002  | overloaded       | 是     | 是     |
| E3003  | timeout          | 是     | 是     |
| E4001  | conflict         | 是     | 否     |
| E4002  | cancelled        | 否     | 否     |
| E9999  | unknown          | 否     | 否     |

### 使用 ai-protocol-mock 进行测试

在无需真实 API 调用的集成测试中，可使用 [ai-protocol-mock](https://github.com/ailib-official/ai-protocol-mock)：

```typescript
import { createClientBuilder } from '@hiddenpath/ai-lib-ts';

process.env.MOCK_HTTP_URL = 'http://localhost:4010';

const client = await createClientBuilder()
  .withMockServer('http://localhost:4010')
  .build('openai/gpt-4o');
```

## 📦 安装

```bash
npm install @hiddenpath/ai-lib-ts
# 或
yarn add @hiddenpath/ai-lib-ts
# 或
pnpm add @hiddenpath/ai-lib-ts
```

## 🔧 配置

库会自动在以下位置查找协议清单：

1. `node_modules/ai-protocol/dist` 或 `node_modules/@hiddenpath/ai-protocol/dist`
2. `../ai-protocol/dist`、`./protocols`
3. GitHub raw `ailib-official/ai-protocol` (main)

### 提供商 API 密钥

通过环境变量设置：`<PROVIDER_ID>_API_KEY`

```bash
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export DEEPSEEK_API_KEY="..."
```

## 🚀 使用示例

### 流式响应

```typescript
const client = await AiClient.new('anthropic/claude-3-5-sonnet');

const stream = client
  .chat([
    Message.system('你是一个乐于助人的助手。'),
    Message.user('讲一个简短的故事。'),
  ])
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
import { Tool } from '@hiddenpath/ai-lib-ts';

const weatherTool = Tool.define(
  'get_weather',
  {
    type: 'object',
    properties: {
      location: { type: 'string', description: '城市名' },
      unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
    },
    required: ['location'],
  },
  '获取指定地点的当前天气'
);

const response = await client
  .chat([Message.user('东京天气怎么样？')])
  .tools([weatherTool])
  .execute();
```

### 批量处理

```typescript
import { batchExecute } from '@hiddenpath/ai-lib-ts';

const op = async (question: string) => {
  const client = await AiClient.new('openai/gpt-4o');
  const r = await client.chat([Message.user(question)]).execute();
  return r.content;
};

const result = await batchExecute(
  ['什么是 AI？', '什么是 Python？', '什么是 async？'],
  op,
  { maxConcurrent: 5 }
);

console.log(`成功: ${result.successfulCount}`);
console.log(`失败: ${result.failedCount}`);
```

### PreflightChecker（请求门控）

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
    const response = await client.chat([Message.user('你好')]).execute();
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

## 支持的提供商

| 提供商   | 模型        | 流式 | 工具 | 视觉 |
|----------|-------------|------|------|------|
| OpenAI   | GPT-4o, GPT-4 | ✅  | ✅   | ✅   |
| Anthropic| Claude 3.5  | ✅   | ✅   | ✅   |
| DeepSeek | DeepSeek Chat | ✅ | ✅   | ❌   |

## API 参考

### 核心类

- **`AiClient`**: AI 模型交互主入口
- **`Message`**: 聊天消息
- **`ContentBlock`**: 多模态内容块
- **`Tool`**: 工具/函数定义
- **`StreamingEvent`**: 流式响应事件

### 弹性类

- **`RetryPolicy`**: 指数退避重试
- **`CircuitBreaker`**: 熔断器
- **`RateLimiter`**: 令牌桶限流
- **`Backpressure`**: 并发限制
- **`PreflightChecker`**: 统一请求门控

### 批处理类

- **`BatchExecutor`**: 并行执行
- **`BatchCollector`**: 请求聚合

## 📖 相关项目

- [AI-Protocol](https://github.com/ailib-official/ai-protocol) - 协议规范（v1.5 / V2）
- [ai-lib-python](https://github.com/ailib-official/ai-lib-python) - Python 运行时
- [ai-lib-rust](https://github.com/ailib-official/ai-lib-rust) - Rust 运行时
- [ai-protocol-mock](https://github.com/ailib-official/ai-protocol-mock) - 统一 mock 服务

## 📄 许可证

本项目采用以下任一许可证：

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE) 或 http://www.apache.org/licenses/LICENSE-2.0)
- MIT License ([LICENSE-MIT](LICENSE-MIT) 或 http://opensource.org/licenses/MIT)

任选其一。

---

**ai-lib-ts** - 协议与 TypeScript 的完美结合。📘✨
