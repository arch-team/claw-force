# OpenClaw Memory、Plugin SDK、Extensions 深度分析

## 一、Memory 系统

### 1.1 整体架构

位于 `src/memory/`，成熟的混合检索记忆系统，支持 `builtin`（SQLite）和 `qmd`（外部 CLI）两种后端。

### 1.2 数据存储

**主存储：SQLite（node:sqlite）**

Schema (`src/memory/memory-schema.ts`):

| 表 | 用途 |
|----|------|
| `meta` | 键值元数据（如 vectorDims） |
| `files` | 已索引文件（path/source/hash/mtime/size） |
| `chunks` | 文本分块（id/path/source/start_line/end_line/hash/model/text/embedding/updated_at） |
| `embedding_cache` | Embedding 缓存（provider/model/provider_key/hash） |
| `chunks_fts` | FTS5 全文搜索虚拟表 |
| `chunks_vec` | sqlite-vec 向量搜索虚拟表 |

通过 Node.js 内置 `node:sqlite` 模块（DatabaseSync）访问。

**向量搜索**: `sqlite-vec` 扩展，SQLite 原生，无需外部向量数据库。

**QMD 后端**: 可选外部 `qmd` CLI 命令，支持更复杂的向量索引和集合管理。

### 1.3 记忆作用域

```typescript
type MemorySource = "memory" | "sessions";
```

| 来源 | 内容 |
|------|------|
| `memory` | MEMORY.md, memory.md, memory/*.md 文件 |
| `sessions` | 会话转录 JSONL 文件（user/assistant 消息） |

**Agent 级隔离**: 每个 `MemoryIndexManager` 通过 `agentId + workspaceDir + settings` 三元组缓存，每个 Agent 有独立 SQLite 数据库。

### 1.4 混合搜索

`manager.ts:search()` — 三层融合:

1. **向量搜索**: Embedding → `chunks_vec` 相似度搜索
2. **FTS 关键词搜索**: SQLite FTS5 BM25 全文检索
3. **混合融合** (`hybrid.ts`):
   - `vectorWeight * vectorScore + textWeight * textScore`
   - **时间衰减** (`temporal-decay.ts`): `e^(-lambda * age)`，半衰期 30 天
   - **MMR 重排序** (`mmr.ts`): Jaccard 相似度平衡相关性与多样性，lambda=0.7

### 1.5 Embedding Providers

| Provider | 方式 |
|----------|------|
| openai | OpenAI API |
| gemini | Google Gemini API |
| voyage | Voyage AI API |
| mistral | Mistral AI API |
| local | node-llama-cpp 本地模型 |

支持 `auto` 自动选择和 `fallback` 链式降级。全部不可用时降级为 FTS-only。

### 1.6 长期/短期记忆

通过隐式机制区分:
- **常驻记忆**: MEMORY.md/memory.md（不受时间衰减影响）
- **日期记忆**: memory/YYYY-MM-DD.md（受时间衰减）
- **会话记忆**: Session 转录（短期上下文）
- 文件观察器 (Chokidar) + 定时同步实时更新

---

## 二、Plugin SDK

### 2.1 插件接口

核心在 `src/plugins/types.ts`:

```typescript
type OpenClawPluginDefinition = {
  id?: string;
  name?: string;
  description?: string;
  version?: string;
  kind?: PluginKind;  // "memory"
  configSchema?: OpenClawPluginConfigSchema;
  register?: (api: OpenClawPluginApi) => void | Promise<void>;
  activate?: (api: OpenClawPluginApi) => void | Promise<void>;
};
```

**Plugin API 注册能力**:

| 方法 | 能力 |
|------|------|
| `registerTool()` | Agent 工具 |
| `registerHook()` | 生命周期钩子 |
| `registerHttpHandler()` / `registerHttpRoute()` | HTTP 处理器 |
| `registerChannel()` | 渠道适配器 |
| `registerGatewayMethod()` | 网关 RPC 方法 |
| `registerCli()` | CLI 命令 |
| `registerService()` | 后台服务 |
| `registerProvider()` | 模型提供者 |
| `registerCommand()` | 聊天命令（绕过 LLM） |
| `on()` | 生命周期事件 |

### 2.2 插件清单

`openclaw.plugin.json`: 必须包含 `id`、`configSchema`，可选 kind/channels/providers/skills/name/description 等。

### 2.3 插件发现（4 层）

| 优先级 | 来源 | 路径 |
|--------|------|------|
| 1 | config | 配置文件 extraPaths |
| 2 | workspace | `.openclaw/extensions/` |
| 3 | global | `~/.config/openclaw/extensions/` |
| 4 | bundled | 内置插件目录 |

含安全检查：路径逃逸检测、世界可写检测、所有权验证。

### 2.4 24 种生命周期钩子

| 层 | 钩子 |
|----|------|
| 模型层 | before_model_resolve, before_prompt_build |
| Agent 层 | before_agent_start, agent_end, llm_input, llm_output |
| 压缩层 | before_compaction, after_compaction, before_reset |
| 消息层 | message_received, message_sending, message_sent |
| 工具层 | before_tool_call, after_tool_call, tool_result_persist, before_message_write |
| 会话层 | session_start, session_end |
| SubAgent 层 | subagent_spawning, subagent_spawned, subagent_ended, subagent_delivery_target |
| 网关层 | gateway_start, gateway_stop |

### 2.5 认证

- **Command Auth**: `allowFrom` 发送者授权
- **Fetch Auth**: Bearer Token Scope 回退链
- **Provider Auth**: OAuth / API Key / Token / Device Code / Custom

---

## 三、Extensions / 渠道适配器

### 3.1 全部渠道列表

**核心渠道（src/ 直接实现）**: Discord(128), Telegram(103), Slack(92), WhatsApp(80), iMessage(25), Signal(32), LINE(46)

**扩展渠道（extensions/）**:
Feishu/Lark(57), MS Teams(71), Matrix(82), Google Chat(18), Mattermost(29), IRC(25), Nostr(23), Twitch(32), Nextcloud Talk(25), Synology Chat(14), Zalo(20+16), BlueBubbles(37), Tlon/Urbit(28)

**功能扩展**: memory-core, memory-lancedb, voice-call, copilot-proxy, llm-task, diagnostics-otel, thread-ownership, talk-voice 等

### 3.2 渠道开发模式

开发新渠道适配器:

1. 创建 `extensions/<channel-name>/` 目录
2. 编写 `openclaw.plugin.json`（id/channels/configSchema）
3. 编写 `package.json`（openclaw 字段声明元数据）
4. 实现 `ChannelPlugin` 接口:
   - `ChannelMeta` — 渠道元数据
   - `ChannelCapabilities` — 能力声明（DM/群聊/线程/媒体/反应/编辑）
   - `ChannelGatewayAdapter` — 网关适配
   - `ChannelMessagingAdapter` — 消息收发
   - `ChannelOutboundAdapter` — 出站消息
   - `ChannelAuthAdapter` — 认证
   - `ChannelSetupAdapter` — 引导配置
   - `ChannelGroupAdapter` — 群组管理
5. `api.registerChannel({ plugin })` 注册

### 3.3 飞书适配器参考

56 个源文件，功能覆盖:
- Bot 消息处理、WebSocket 事件监控
- 流式卡片响应、富文本互动卡片
- Bitable/Doc/Wiki/Drive/Perm 工具
- @提及、线程、媒体上传
- 依赖 `@larksuiteoapi/node-sdk`

---

## 四、Skills / ClawHub

### 4.1 Skill 定义

每个 Skill 是 `skills/<name>/SKILL.md`:

```yaml
---
name: skill-name
description: 触发条件描述
metadata:
  openclaw:
    emoji: "🧩"
    requires:
      anyBins: ["claude", "codex"]
---
# Markdown 指令正文
```

### 4.2 ClawHub 生态

- 注册中心: `https://clawhub.com`
- CLI: `clawhub` npm 包
- 操作: search / install / update / list / publish
- 52 个内置 Skill（1password 到 xurl）

### 4.3 Skill 与 Agent 绑定

- `openclaw.plugin.json` 的 `skills` 字段声明
- Agent 配置 `skills: string[]` 过滤可用 Skill

---

## 五、Cron / Scheduling 系统

### 5.1 三种调度类型

| 类型 | 说明 |
|------|------|
| `at` | 一次性绝对时间 |
| `every` | 固定间隔（毫秒）+ 可选锚点 |
| `cron` | Cron 表达式（croner 库），支持时区和 stagger |

### 5.2 执行模式

- `sessionTarget`: `"main"` / `"isolated"` 会话目标
- `wakeMode`: `"now"` / `"next-heartbeat"` 唤醒
- `payload`: `systemEvent`（系统事件）/ `agentTurn`（Agent 轮次）
- `delivery`: `none` / `announce` / `webhook`

### 5.3 持久化与运行时

- 存储: JSON 文件（~/.config/openclaw/cron/jobs.json）
- 原子写入 + 备份
- 并发限制、超时中断、连续错误退避
- Session Reaper 清理过期 Cron 会话

---

## 六、企业化扩展评估

| 子系统 | 扩展评分 | 说明 |
|--------|---------|------|
| Memory | ⭐⭐⭐⭐ | Agent 级隔离已有，需增加 org/dept 级分区 |
| Plugin SDK | ⭐⭐⭐⭐⭐ | 8 种注册能力 + 24 种钩子，扩展性极强 |
| 渠道适配器 | ⭐⭐⭐⭐⭐ | 标准化接口，新渠道开发模式清晰 |
| Skills | ⭐⭐⭐⭐ | 声明式 + 按 Agent 过滤，可扩展为岗位技能库 |
| Cron | ⭐⭐⭐ | 基于文件持久化，企业场景需迁移到 DB |
