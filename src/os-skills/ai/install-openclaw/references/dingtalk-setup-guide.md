# 钉钉开发者平台配置指南

SKILL.md 的补充参考文档，详细说明钉钉侧的配置步骤。

---

## 1. 创建钉钉应用

1. 访问 [钉钉开发者后台](https://open-dev.dingtalk.com/)
2. 创建**企业内部应用**
3. 添加「机器人」能力
4. 消息接收模式选 **Stream 模式**
5. 发布应用

## 2. 权限管理

进入应用 → 权限管理，开启以下权限：

| 权限 | 说明 |
|------|------|
| Card.Instance.Write | 创建和投放卡片实例 |
| Card.Streaming.Write | 流式更新卡片 |
| 机器人消息发送 | 允许向单聊/群聊发消息 |
| 媒体文件上传 | 允许发送图片、语音、视频、文件 |

## 3. AI 卡片模板（可选）

仅当 `messageType` 为 `card` 时需要：

1. 访问 [钉钉卡片平台](https://open-dev.dingtalk.com/fe/card)
2. 进入「我的模板」→「创建模板」
3. 场景选 **「AI 卡片」**
4. 设计排版后保存并发布
5. 记下：
   - **模板 ID**（格式 `xxxxx-xxxxx-xxxxx.schema`）→ 对应 `cardTemplateId`
   - **内容字段名**（默认 `content`）→ 对应 `cardTemplateKey`

> 官方 AI 卡片模板的 `cardTemplateKey` 默认为 `content`，无需修改。

## 4. 获取凭证

从开发者后台获取以下信息：

| 凭证 | 脚本参数 |
|------|----------|
| AppKey (Client ID) | `--dingtalk-client-id` |
| AppSecret (Client Secret) | `--dingtalk-client-secret` |
| Robot Code（= AppKey） | `--dingtalk-robot-code` |
| Corp ID（企业 ID） | `--dingtalk-corp-id` |
| Agent ID（应用 ID） | `--dingtalk-agent-id` |

## 5. 百炼 DashScope API Key

1. 访问 [百炼控制台](https://dashscope.console.aliyun.com/)
2. 创建 API Key
3. 传入脚本 `--dashscope-api-key`

参考文档：[百炼 OpenClaw 接入](https://help.aliyun.com/zh/model-studio/openclaw)

---

## 安全策略说明

### 私聊策略 (dmPolicy)

| 值 | 行为 |
|----|------|
| `open` | 任何人可私聊 |
| `pairing` | 新用户需配对码验证 |
| `allowlist` | 仅白名单用户 |

### 群聊策略 (groupPolicy)

| 值 | 行为 |
|----|------|
| `open` | 任何群可 @机器人 |
| `allowlist` | 仅配置的群 |

---

## 消息类型支持

### 接收

| 类型 | 支持 | 说明 |
|------|------|------|
| 文本 | yes | 完整支持 |
| 富文本 | yes | 提取文本 |
| 图片 | yes | 下载传递给 AI |
| 语音 | yes | 钉钉语音识别 |
| 视频 | yes | 下载传递给 AI |
| 文件 | yes | 下载传递给 AI |

### 发送

| 类型 | 支持 | 说明 |
|------|------|------|
| 文本 | yes | 完整支持 |
| Markdown | yes | 自动检测 |
| 互动卡片 | yes | 支持流式更新 |
| 图片 | yes | 上传后发送 |
| 语音/视频/文件 | yes | 上传后发送 |

> 当前不支持图文混排。图片需单独调用 `outbound.sendMedia(...)` 发送。

---

## 配置选项速查

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | boolean | `true` | 启用 |
| `clientId` | string | **必填** | AppKey |
| `clientSecret` | string | **必填** | AppSecret |
| `robotCode` | string | - | 机器人代码 |
| `corpId` | string | - | 企业 ID |
| `agentId` | string | - | 应用 ID |
| `dmPolicy` | string | `open` | 私聊策略 |
| `groupPolicy` | string | `open` | 群聊策略 |
| `messageType` | string | `markdown` | 消息类型 |
| `cardTemplateId` | string | - | 卡片模板 ID |
| `cardTemplateKey` | string | `content` | 卡片字段 Key |
| `debug` | boolean | `false` | 调试日志 |
| `mediaMaxMb` | number | 5 | 文件上限(MB) |
| `maxConnectionAttempts` | number | 10 | 最大重连次数 |
| `initialReconnectDelay` | number | 1000 | 初始重连延迟(ms) |
| `maxReconnectDelay` | number | 60000 | 最大重连延迟(ms) |
| `reconnectJitter` | number | 0.3 | 重连抖动因子 |

---

## 手动配置示例

如不使用脚本，可手动编辑 `~/.openclaw/openclaw.json`：

```json5
{
  "plugins": {
    "enabled": true,
    "allow": ["dingtalk"]
  },
  "models": {
    "mode": "merge",
    "providers": {
      "bailian": {
        "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "apiKey": "DASHSCOPE_API_KEY",
        "api": "openai-completions",
        "models": [{
          "id": "qwen3-max-2026-01-23",
          "name": "qwen3-max-thinking",
          "reasoning": false,
          "input": ["text"],
          "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
          "contextWindow": 262144,
          "maxTokens": 65536
        }]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": { "primary": "bailian/qwen3-max-2026-01-23" },
      "models": {
        "bailian/qwen3-max-2026-01-23": { "alias": "qwen3-max-thinking" }
      },
      "maxConcurrent": 4,
      "subagents": { "maxConcurrent": 8 }
    }
  },
  "channels": {
    "dingtalk": {
      "enabled": true,
      "clientId": "dingxxxxxx",
      "clientSecret": "your-app-secret",
      "robotCode": "dingxxxxxx",
      "corpId": "dingxxxxxx",
      "agentId": "123456789",
      "dmPolicy": "open",
      "groupPolicy": "open",
      "messageType": "markdown"
    }
  }
}
```
