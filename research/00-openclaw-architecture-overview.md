# OpenClaw 架构总览与 ClawForce 扩展评估

**项目**: OpenClaw v2026.2.27
**Stars**: 237K+ | **语言**: TypeScript | **运行时**: Node.js >= 22.12
**定位**: 多渠道 AI 网关，可扩展的消息集成个人 AI 助手平台

---

## 一、项目技术栈概览

| 维度 | 技术选型 |
|------|---------|
| **包管理** | pnpm 10.23 Monorepo (4 层工作区) |
| **运行时** | Node.js >= 22.12 |
| **语言** | TypeScript 5.9 (ESM, ES2023 target) |
| **构建** | tsdown (esbuild/rolldown) |
| **HTTP/WS** | Express 5.x + ws 8.x |
| **UI** | Lit 3.x + Vite 7.x |
| **测试** | Vitest 4.x (70% 覆盖率) |
| **Lint/Fmt** | oxlint + oxfmt (Rust 实现) |
| **数据库** | SQLite (node:sqlite) + sqlite-vec 向量扩展 |
| **LLM** | OpenAI/Anthropic/Google/AWS Bedrock/Qwen/MiniMax/本地(node-llama-cpp) |
| **渠道** | 21+ 消息平台 (Discord/Telegram/Slack/WhatsApp/飞书等) |

**代码规模**: ~4900 .ts 文件, src/ 下 3942 文件, 49 个核心子模块

---

## 二、架构模块关系图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        External Channels                            │
│  Discord│Telegram│Slack│WhatsApp│Feishu│MSTeams│Matrix│IRC│...      │
└────────────────────────┬────────────────────────────────────────────┘
                         │ ChannelPlugin Interface
┌────────────────────────▼────────────────────────────────────────────┐
│                    Gateway (Express + WebSocket)                     │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐               │
│  │  HTTP API    │  │  WS Server   │  │  Auth Layer │               │
│  │  /hooks/*    │  │  RPC Engine  │  │  token/pwd/ │               │
│  │  /v1/chat    │  │  90+ methods │  │  tailscale  │               │
│  │  /v1/resp    │  │  JSON-RPC    │  │  trust-proxy│               │
│  └──────┬──────┘  └──────┬───────┘  └──────┬──────┘               │
│         │                │                  │                       │
│  ┌──────▼────────────────▼──────────────────▼──────┐               │
│  │        Authorization (Role + Scope)              │               │
│  │  Roles: operator | node                          │               │
│  │  Scopes: admin | read | write | approvals | pair │               │
│  └──────────────────────┬──────────────────────────┘               │
└─────────────────────────┼──────────────────────────────────────────┘
                          │
         ┌────────────────┼──────────────────┐
         │                │                  │
┌────────▼──────┐  ┌──────▼──────┐  ┌───────▼──────┐
│   Routing     │  │  Config     │  │   Plugins    │
│  7-tier match │  │  Zod Schema │  │  4-layer disc│
│  bindings     │  │  Runtime    │  │  8 reg types │
│  session keys │  │  Secrets    │  │  24 hooks    │
└───────┬───────┘  └─────────────┘  └──────────────┘
        │
┌───────▼───────────────────────────────────────────────────────┐
│                      Agent System                              │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────────┐ │
│  │ Main Agent   │  │ SubAgent      │  │ ACP Runtime        │ │
│  │ system prompt│  │ spawn/registry│  │ (Claude Code/Codex)│ │
│  │ SOUL.md      │  │ depth control │  │ oneshot/persistent │ │
│  │ identity     │  │ A2A protocol  │  │                    │ │
│  └──────┬───────┘  └───────┬───────┘  └────────────────────┘ │
│         │                  │                                   │
│  ┌──────▼──────────────────▼───────────────────────────────┐  │
│  │              Tools System (78+ tools)                    │  │
│  │  sessions_spawn│sessions_send│subagents│bash│browser│... │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
        │
┌───────▼───────────────────────────────────────────────────────┐
│                    Support Systems                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
│  │ Memory   │  │ Skills   │  │ Cron     │  │ Auto-Reply   │ │
│  │ SQLite   │  │ 52 built │  │ at/every │  │ Template     │ │
│  │ Vec+FTS5 │  │ ClawHub  │  │ cron expr│  │ Streaming    │ │
│  │ Hybrid   │  │ SKILL.md │  │ delivery │  │ History      │ │
│  │ MMR+Decay│  │          │  │          │  │              │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

---

## 三、消息全生命周期

### 入站路径（外部渠道 → Agent 执行）

```
1. [Channel Plugin] 接收外部消息 (webhook/websocket/polling)
2. [dispatchInboundMessage()] 消息入站分发
3. [resolveAgentRoute()] 7 层路由匹配:
   │  T1: binding.peer (精确用户/群组绑定)
   │  T2: binding.peer.parent (线程继承)
   │  T3: binding.guild+roles (Discord)
   │  T4: binding.guild (Discord)
   │  T5: binding.team (Slack)
   │  T6: binding.account (Bot 账号)
   │  T7: binding.channel (渠道默认)
   │  Fallback: default Agent
4. [agentCommand()] 调用目标 Agent
5. [LLM Execution] 模型推理 + Tool Calling
6. [routeReply()] → [deliverOutboundPayloads()] 回复到原始渠道
```

### RPC 路径（WS 客户端 → Gateway）

```
1. [WS Connect] → connect.challenge (nonce)
2. [connect] 认证 (token/password/tailscale/trusted-proxy)
3. [RPC Frame] {type:"req", method, params}
4. [authorizeGatewayMethod()] Role → Scope 双层权限
5. [Handler] extraHandlers[method] ?? coreGatewayHandlers[method]
6. [Response] → WS 回传
```

### SubAgent 协作路径

```
1. [Main Agent] LLM 决定调用 sessions_spawn 工具
2. [spawnSubagentDirect()] 深度/并发/权限检查
3. [Session 创建] agent:{id}:subagent:{UUID}
4. [System Prompt] buildSubagentSystemPrompt() (minimal mode)
5. [Gateway RPC agent] 启动子 Agent
6. [SubAgent 执行] 独立 LLM 推理 + Tool Calling
7. [自动 Announce] 结果推送给 parent Agent
8. [Registry 更新] 状态归档或清理
```

---

## 四、7 个扩展点企业化适配度评分

### 4.1 Extension Channels — ⭐⭐⭐⭐⭐ (原样复用 + 扩展)

| 评估 | 说明 |
|------|------|
| 现状 | 21+ 渠道，标准化 ChannelPlugin 接口，飞书已有完整适配器 |
| 可复用性 | 直接复用，新增钉钉/企业微信只需开发适配器 |
| 企业化差距 | 缺 DingTalk/WeCom 适配器（约 2-3 周/渠道） |
| 策略 | **原样复用** + 新增国内渠道适配器 |

### 4.2 Skills / ClawHub — ⭐⭐⭐⭐ (原样复用 + 包装)

| 评估 | 说明 |
|------|------|
| 现状 | 52 个内置 Skill，SKILL.md 声明式，ClawHub 生态 |
| 可复用性 | 直接复用，per-Agent 过滤已支持 |
| 企业化差距 | 缺企业 Skill 库管理、权限控制、版本审核 |
| 策略 | **原样复用** + 包装企业 Skill 管理层 |

### 4.3 Plugin SDK — ⭐⭐⭐⭐⭐ (原样复用)

| 评估 | 说明 |
|------|------|
| 现状 | 8 种注册能力 + 24 种钩子，极其完善 |
| 可复用性 | 直接复用，Admin UI 可通过 Plugin HTTP Route 集成 |
| 企业化差距 | 无，现有 API 完全满足企业扩展需求 |
| 策略 | **原样复用**，通过 registerHttpRoute/registerGatewayMethod 扩展企业功能 |

### 4.4 Webhooks — ⭐⭐⭐⭐ (原样复用 + 扩展)

| 评估 | 说明 |
|------|------|
| 现状 | /hooks/* HTTP 端点，支持 agent/wake/custom 映射 |
| 可复用性 | 直接复用，可连接企业工作流引擎 |
| 企业化差距 | 缺审计日志、回调确认、重试机制 |
| 策略 | **原样复用** + 企业层添加审计和重试 |

### 4.5 Multi-Agent Routing — ⭐⭐⭐⭐ (扩展)

| 评估 | 说明 |
|------|------|
| 现状 | 7 层 tier 匹配，已有 guild/team/roles 概念 |
| 可复用性 | 路由框架直接复用 |
| 企业化差距 | 缺 org/dept 层级，无角色发现机制 |
| 策略 | **扩展** — 增加 organization/department tiers + Agent 角色目录 |

### 4.6 SubAgent 编排 — ⭐⭐⭐⭐ (扩展)

| 评估 | 说明 |
|------|------|
| 现状 | 层级化 spawn, A2A 对话, Steer/Kill, Registry 持久化 |
| 可复用性 | 编排原语完善，作为 AI Dev Team 的协作基础 |
| 企业化差距 | 缺声明式工作流 DSL、多 Agent GroupChat、任务看板集成 |
| 策略 | **扩展** — 添加工作流引擎 + 任务跟踪层 |

### 4.7 Cron / Scheduling — ⭐⭐⭐ (包装 + 部分重建)

| 评估 | 说明 |
|------|------|
| 现状 | at/every/cron 三种模式，JSON 文件持久化 |
| 可复用性 | 调度逻辑可复用 |
| 企业化差距 | 文件持久化不适合企业，缺审批触发、工作流集成 |
| 策略 | **包装** — 保留调度引擎，持久化迁移到 PostgreSQL |

---

## 五、复用 vs 重建矩阵

| 子系统 | 策略 | 改动量 | 优先级 |
|--------|------|--------|--------|
| Gateway (HTTP/WS/RPC) | **原样复用** | 0 | - |
| 权限系统 (Role+Scope) | **扩展** — 增加企业角色/组织层 | 中 | P1 |
| 路由系统 (7-tier) | **扩展** — 增加 org/dept tiers | 低 | P1 |
| Agent 配置 (Zod Schema) | **扩展** — 增加角色/部门字段 | 低 | P1 |
| Agent Identity | **扩展** — 增加 role/department/expertise | 低 | P1 |
| SubAgent 编排 | **扩展** — 增加工作流引擎层 | 高 | P2 |
| Session 管理 | **扩展** — 增加 org/tenant 隔离 | 中 | P2 |
| Memory 系统 | **扩展** — 增加 org 级分区 | 中 | P2 |
| Plugin SDK | **原样复用** | 0 | - |
| Extension Channels | **原样复用** + 新增适配器 | 中 | P2 |
| Skills / ClawHub | **包装** — 企业 Skill 管理层 | 低 | P3 |
| Cron 系统 | **包装** — DB 持久化层 | 中 | P3 |
| Admin UI | **全新构建** | 高 | P1 |
| Enterprise API | **全新构建** | 高 | P1 |
| 工作流引擎 | **全新构建** | 高 | P2 |
| 绩效仪表盘 | **全新构建** | 中 | P3 |

---

## 六、国内生态差距报告

### 6.1 已有支持

| 生态 | 状态 | 位置 |
|------|------|------|
| 飞书/Lark | ✅ 完整 (56 文件) | extensions/feishu |
| 千问 (Qwen) | ✅ Portal Auth | extensions/qwen-portal-auth |
| 火山引擎 (VolcEngine) | ✅ Provider | src/providers/ |
| MiniMax | ✅ Portal Auth | extensions/minimax-portal-auth |

### 6.2 缺失项与工作量估算

| 缺失项 | 工作量 | 复杂度 | 优先级 |
|--------|--------|--------|--------|
| **钉钉渠道适配器** | 3-4 周 | 高 (OAuth + 事件订阅 + 互动卡片) | P1 |
| **企业微信渠道适配器** | 3-4 周 | 高 (企业应用 + 回调 + 素材) | P1 |
| **DeepSeek LLM Provider** | 1 周 | 低 (OpenAI 兼容 API) | P1 |
| **通义千问完整 Provider** | 1-2 周 | 中 (需适配 DashScope API) | P2 |
| **百度文心一言 Provider** | 1-2 周 | 中 | P3 |
| **讯飞星火 Provider** | 1 周 | 中 | P3 |
| **国内云部署方案** | 2-3 周 | 中 (阿里云/腾讯云容器化) | P2 |
| **中文 Embedding 模型** | 1 周 | 低 (BGE/M3E 集成) | P2 |

### 6.3 总工作量估算

- **P1（必须）**: 钉钉 + 企业微信 + DeepSeek ≈ 7-9 周
- **P2（重要）**: 通义千问 + 国内云部署 + 中文 Embedding ≈ 4-6 周
- **P3（可选）**: 百度文心 + 讯飞星火 ≈ 2-3 周

---

## 七、关键架构发现

### 7.1 利好 ClawForce 的设计

1. **插件化极致**: 8 种注册能力 + 24 种钩子，企业功能可通过插件无侵入添加
2. **多 Agent 原语完善**: spawn/send/steer/kill + A2A 对话，AI Dev Team 可直接构建
3. **渠道标准化**: ChannelPlugin 接口清晰，新渠道开发模式成熟
4. **Agent 身份体系**: Identity + SOUL.md 天然支持 AI 员工角色注入
5. **路由可扩展**: 已有 guild/team/roles 概念，org/dept 扩展自然

### 7.2 需要注意的风险

1. **SQLite 单机限制**: Memory 和 Cron 都基于 SQLite/JSON 文件，不适合多实例部署
2. **无原生工作流引擎**: SubAgent 编排靠 LLM Tool Calling，缺声明式 DSL
3. **无多 Agent GroupChat**: 只有点对点 A2A，没有多方讨论
4. **无审计日志**: Gateway 无请求审计，需企业层补充
5. **无多租户**: Session Key 无 tenant 维度，需扩展

### 7.3 OpenClaw Fork 策略建议

```
┌─────────────────────────────────────────────┐
│              Enterprise Admin UI             │  全新 React + Ant Design 5
├─────────────────────────────────────────────┤
│            Enterprise API Layer              │  全新 Node.js/FastAPI
│  ┌───────────┐ ┌──────────┐ ┌────────────┐ │
│  │ RBAC &    │ │ Workflow  │ │ Dashboard  │ │
│  │ Org Mgmt  │ │ Engine   │ │ & KPI      │ │
│  └─────┬─────┘ └─────┬────┘ └──────┬─────┘ │
├────────┼──────────────┼─────────────┼───────┤
│        └──── WS/RPC ──┴─── API ────┘       │
│           OpenClaw Core (Fork)               │
│  最小差异修改:                                │
│  • 权限层增加 org/dept                        │
│  • 路由增加组织层级 tier                       │
│  • Agent Identity 扩展                        │
│  • Session Key 增加 tenant                    │
│                                              │
│  新增文件（不修改核心）:                        │
│  • extensions/dingtalk/                       │
│  • extensions/wecom/                          │
│  • src/providers/deepseek/                    │
│  • 企业级 Plugin                              │
└──────────────────────────────────────────────┘
```

---

## 八、Phase 1 结论

**OpenClaw 适合作为 ClawForce 的核心引擎**。其插件化架构、多 Agent 编排原语和渠道标准化为企业 AI 员工平台提供了坚实基础。

**核心策略**: Fork + 最小差异扩展 + 企业层包装

**关键数字**:
- 可直接复用: **~70%** 功能（Gateway/Plugin SDK/Channels/Agent 系统/Memory/Skills）
- 需扩展: **~20%** 功能（权限/路由/Agent 身份/Session 隔离）
- 需全新构建: **~10%** 功能（Admin UI/Enterprise API/工作流引擎/仪表盘）
- 国内生态适配: 约 **13-18 周** 总工作量
