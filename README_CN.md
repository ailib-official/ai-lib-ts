# ai-lib-ts

**AI-Protocol TypeScript 运行时** - 官方 TypeScript/Node.js 实现，提供统一的 AI 模型交互接口。

`ai-lib-ts` 是 [AI-Protocol](https://github.com/hiddenpath/ai-protocol) 的官方 TypeScript 运行时，提供统一的接口与不同提供商的 AI 模型交互，无需硬编码提供商特定逻辑。

## 🎯 设计哲学

- **协议驱动**：所有行为通过协议清单配置，而非代码
- **提供商无关**：统一接口支持 OpenAI、Anthropic、Google、DeepSeek 等 30+ 提供商
- **流式优先**：原生支持 Server-Sent Events (SSE) 流式响应
- **类型安全**：强类型的请求/响应处理和全面的错误类型

## 📦 安装

```bash
npm install @hiddenpath/ai-lib-ts

# 或
yarn add @hiddenpath/ai-lib-ts

# 或
pnpm add @hiddenpath/ai-lib-ts
```

## 🚀 快速开始

### 基本用法

```typescript
import { AiClient, Message } from '@hiddenpath/ai-lib-ts';

// 为特定模型创建客户端
const client = await AiClient.new('deepseek/deepseek-chat');

// 发送聊天请求
const response = await client
  .chat([
    Message.system('你是一个有用的助手。'),
    Message.user('你好！'),
  ])
  .temperature(0.7)
  .maxTokens(500)
  .execute();

console.log(response.content);
console.log(response.usage);
```

### 流式响应

```typescript
import { AiClient, Message } from '@hiddenpath/ai-lib-ts';

const client = await AiClient.new('openai/gpt-4o');

// 流式获取响应
const stream = client
  .chat([Message.user('给我讲个故事')])
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
  '获取指定地点的当前天气'
);

const response = await client
  .chat([Message.user('东京的天气怎么样？')])
  .tools([weatherTool])
  .execute();

if (response.toolCalls) {
  for (const tc of response.toolCalls) {
    console.log(`工具: ${tc.function.name}`);
    console.log(`参数: ${tc.function.arguments}`);
  }
}
```

### 客户端构建器

```typescript
import { createClientBuilder, MOCK_SERVER_URL } from '@hiddenpath/ai-lib-ts';

// 使用 Mock 服务器进行测试（默认: http://192.168.2.13:4010）
const client = await createClientBuilder()
  .withMockServer() // 或 .withMockServer('http://your-mock:4010')
  .withTimeout(30000)
  .build('openai/gpt-4o');

// 带回退模型
const clientWithFallbacks = await createClientBuilder()
  .withFallbacks(['anthropic/claude-3-5-sonnet', 'deepseek/deepseek-chat'])
  .build('openai/gpt-4o');
```

## 🏗️ 架构

### 协议层 (`protocol/`)
- **Loader**：从本地文件、npm 包或远程 URL 加载协议清单
- **Validator**：根据 JSON Schema 验证清单
- **Manifest**：强类型协议配置结构

### 传输层 (`transport/`)
- **HttpTransport**：具有重试、超时和流式支持的 HTTP 客户端
- 使用原生 `fetch` API 以获得最大兼容性

### 管道层 (`pipeline/`)
- **Decoder**：将原始字节解析为 SSE 帧
- **Selector**：根据条件过滤帧
- **EventMapper**：将提供商帧转换为统一事件

### 客户端层 (`client/`)
- **AiClient**：AI 交互的主入口点
- **AiClientBuilder**：使用自定义选项配置客户端
- **ChatBuilder**：用于构建聊天请求的流畅 API

## 📋 标准错误码 (V2)

所有提供商错误被分类为 13 个标准错误码：

| 代码   | 名称             | 可重试 | 可回退 |
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

## 🧪 使用 Mock 服务器测试

使用 [ai-protocol-mock](https://github.com/hiddenpath/ai-protocol-mock) 进行无真实 API 调用的测试：

```typescript
import { createClientBuilder } from '@hiddenpath/ai-lib-ts';

// 设置环境变量
process.env.MOCK_HTTP_URL = 'http://192.168.2.13:4010';

// 或使用构建器方法
const client = await createClientBuilder()
  .withMockServer('http://192.168.2.13:4010')
  .build('openai/gpt-4o');
```

## 📚 API 参考

### 类型

```typescript
// 消息类型
interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentBlock[];
}

// 流式事件
type StreamingEvent =
  | { event_type: 'PartialContentDelta'; content: string }
  | { event_type: 'ToolCallStarted'; tool_call_id: string; tool_name: string }
  | { event_type: 'StreamEnd'; finish_reason?: string }
  // ... 更多事件类型

// 工具类型
interface ToolDefinition {
  name: string;
  description?: string;
  parameters: unknown;
  strict?: boolean;
}
```

### 客户端

```typescript
// 创建客户端
const client = await AiClient.new('provider/model-name');

// 聊天请求
const response = await client
  .chat(messages)
  .temperature(0.7)
  .maxTokens(1000)
  .tools([...])
  .execute();

// 流式
const stream = client.chat(messages).stream().executeStream();
for await (const event of stream) {
  // 处理事件
}
```

## 🔗 相关项目

- [AI-Protocol](https://github.com/hiddenpath/ai-protocol) - 提供商无关的规范
- [ai-lib-rust](https://github.com/hiddenpath/ai-lib-rust) - Rust 运行时实现
- [ai-lib-python](https://github.com/hiddenpath/ai-lib-python) - Python 运行时实现
- [ai-protocol-mock](https://github.com/hiddenpath/ai-protocol-mock) - 统一 Mock 服务器

## 📄 许可证

根据以下任一许可证授权：

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE) 或 http://www.apache.org/licenses/LICENSE-2.0)
- MIT license ([LICENSE-MIT](LICENSE-MIT) 或 http://opensource.org/licenses/MIT)

由您选择。

### 贡献

除非您明确声明，否则任何有意提交以包含在本作品中的贡献均应按上述方式双许可，不附加任何额外条款或条件。
