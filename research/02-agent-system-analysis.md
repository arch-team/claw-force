# OpenClaw Agent 系统与 SubAgent 编排机制深度分析

## 一、Agent 定义与配置

### 1.1 Agent 数据模型

Agent 配置通过 Zod schema 定义在 `src/config/zod-schema.agent-runtime.ts`:

```typescript
AgentEntrySchema = z.object({
  id: z.string(),                       // 唯一标识
  default: z.boolean().optional(),      // 是否默认 Agent
  name: z.string().optional(),          // 显示名称
  workspace: z.string().optional(),     // 工作目录
  agentDir: z.string().optional(),      // Agent 数据目录
  model: AgentModelSchema.optional(),   // 模型配置（primary + fallbacks）
  skills: z.array(z.string()).optional(), // 技能过滤列表
  memorySearch: MemorySearchSchema,     // 记忆搜索配置
  humanDelay: HumanDelaySchema,         // 人类延迟模拟
  heartbeat: HeartbeatSchema,           // 心跳配置
  identity: IdentitySchema,            // 身份信息（name/theme/emoji/avatar）
  groupChat: GroupChatSchema,           // 群聊配置
  subagents: SubagentsSchema,           // SubAgent 配置
  sandbox: AgentSandboxSchema,          // 沙箱配置
  tools: AgentToolsSchema,             // 工具策略配置
});
```

### 1.2 System Prompt 构造

两层结构：

**主 Agent** (`src/agents/system-prompt.ts:buildAgentSystemPrompt()`):
- 三种 PromptMode: `"full"` (主Agent) / `"minimal"` (SubAgent) / `"none"` (纯身份)
- 包含 Tooling/Safety/Skills/Memory/Messaging/Workspace/Runtime 等 section
- 支持 SOUL.md 人格文件注入
- 动态列出可用工具描述
- 注入 runtime 信息（agentId/host/os/model/channel）

**SubAgent** (`src/agents/subagent-announce.ts:buildSubagentSystemPrompt()`):
- 明确限定任务范围
- 禁止主动对话/心跳/cron
- Push-based 完成通知（最终消息自动报告给 parent）

### 1.3 Agent 生命周期事件

定义在 `src/agents/subagent-lifecycle-events.ts`:

| 结束原因 | 说明 |
|---------|------|
| COMPLETE | 正常完成 |
| ERROR | 错误终止 |
| KILLED | 被主动杀掉 |
| SESSION_RESET | Session 重置 |
| SESSION_DELETE | Session 删除 |

---

## 二、SubAgent 编排

### 2.1 生成机制

核心函数 `spawnSubagentDirect()` (`src/agents/subagent-spawn.ts`):

1. **参数解析**: task/label/agentId/model/thinking/timeout/mode/cleanup
2. **深度检查**: `getSubagentDepthFromSessionStore()` vs `maxSpawnDepth`（默认 1）
3. **并发检查**: `countActiveRunsForSession()` vs `maxChildrenPerAgent`（默认 5）
4. **Agent 权限检查**: `subagents.allowAgents` 白名单
5. **Session 创建**: `agent:{targetAgentId}:subagent:{UUID}`
6. **模型配置**: 通过 Gateway RPC `sessions.patch` 设置
7. **Thread 绑定**: hook `subagent_spawning` 创建消息线程
8. **注入 System Prompt**: `buildSubagentSystemPrompt()`
9. **发起调用**: Gateway RPC `agent` 启动子 Agent
10. **注册记录**: `registerSubagentRun()`

**两种模式**:
- `"run"` (一次性): 完成后清理 session
- `"session"` (持久化): 绑定线程，接受后续消息

### 2.2 SubAgent 注册表

`src/agents/subagent-registry.ts` — 内存 Map + 磁盘持久化:

- **持久化**: `persistSubagentRunsToDisk()` / `restoreSubagentRunsFromDisk()`
- **监听器**: 监听 `lifecycle` 事件流
- **Sweeper**: 定时清理过期 runs（60 分钟归档）
- **孤儿回收**: `reconcileOrphanedRun()`
- **嵌套层级**: `listDescendantRunsForRequester()`
- **Steer-Restart**: 运行中重定向 SubAgent

### 2.3 并发与深度限制

```typescript
DEFAULT_AGENT_MAX_CONCURRENT = 4;       // Agent 最大并发
DEFAULT_SUBAGENT_MAX_CONCURRENT = 8;    // SubAgent 最大并发
DEFAULT_SUBAGENT_MAX_SPAWN_DEPTH = 1;   // 默认嵌套深度 1
```

---

## 三、Multi-Agent 协作

### 3.1 三种通信机制

**1. `sessions_send` 工具** (`src/agents/tools/sessions-send-tool.ts`):
- 通过 sessionKey 或 label 定位目标
- 发送消息等待回复
- A2A 策略控制: `tools.agentToAgent.enabled/allow`
- 可见性: `"self" | "tree" | "agent" | "all"` 四级
- 沙箱限制: 只能向 spawner 发送

**2. `subagents` 工具** (`src/agents/tools/subagents-tool.ts`):
- **list**: 查看活跃和最近的 SubAgent（状态/模型/时长/token）
- **kill**: 杀掉 SubAgent（支持 `"all"` 和级联）
- **steer**: 中断并重新指导 SubAgent

**3. Auto Announce**:
- SubAgent 完成后自动向 requester 推送结果
- Push-based，无需轮询

### 3.2 A2A 对话协议

`src/agents/tools/sessions-send-tool.a2a.ts` — `runSessionsSendA2AFlow()`:

1. Requester 发送消息 → Target 处理回复
2. 支持 `maxPingPongTurns > 0` 多轮对话
3. 每轮注入 `buildAgentToAgentReplyContext`
4. 最终结果通过 announce 投递到渠道

### 3.3 GroupChat

通过 `GroupChatSchema` 配置：
- `mentionPatterns`: @提及模式
- `historyLimit`: 历史消息窗口
- **注意**: 这是单 Agent 在群聊中的行为配置，不是多 Agent GroupChat

### 3.4 ACP 集成

`src/agents/acp-spawn.ts` — 外部 Agent 集成:
- Session key: `agent:{agentId}:acp:{UUID}`
- 支持 `oneshot` / `persistent` 两种模式
- 可桥接 Claude Code、Codex、Gemini 等外部 Agent

---

## 四、企业化扩展潜力

### 4.1 AI 员工角色注入 — ⭐⭐⭐⭐⭐

| 已有基础 | 扩展方向 |
|---------|---------|
| Identity: name/theme/emoji/avatar | 增加 role/department/expertise |
| SOUL.md 人格注入 | 作为 "员工手册" 机制 |
| 独立 workspace/agentDir | 员工级数据隔离 |
| 多 Agent 列表 | 企业员工目录 |
| Per-Agent skills 过滤 | 岗位技能匹配 |

### 4.2 团队协作编排 — ⭐⭐⭐⭐

| 已有基础 | 扩展方向 |
|---------|---------|
| 层级化 spawn (maxSpawnDepth) | Orchestrator → Workers 模式 |
| 并发控制 (maxChildrenPerAgent) | 团队规模控制 |
| allowAgents 白名单 | 组织协作权限 |
| A2A ping-pong 对话 | Agent 间协商 |
| Steer 重定向 | 管理者实时调度 |
| 级联 Kill | 任务链终止 |

### 4.3 当前限制

- 无原生多 Agent GroupChat 讨论机制
- 编排依赖 LLM tool calling，无声明式工作流 DSL
- 无 Agent 角色发现/匹配机制（需显式指定 agentId）
- SubAgent 默认嵌套深度仅 1

---

## 五、架构图

```
┌─────────────────────────────────────────────────┐
│                   Gateway (RPC)                  │
│  agent / agent.wait / sessions.patch / send      │
└──────────┬──────────────────────────┬────────────┘
           │                          │
    ┌──────▼──────┐           ┌──────▼──────┐
    │  Main Agent │           │  ACP Runtime │
    │  (depth 0)  │           │ (Claude Code │
    │             │           │  Codex etc.) │
    └──┬──────┬───┘           └─────────────┘
       │      │
  ┌────▼──┐ ┌─▼────┐    sessions_spawn
  │SubAgt1│ │SubAgt2│    (runtime=subagent)
  │(dep 1)│ │(dep 1)│
  └──┬────┘ └───────┘
     │
  ┌──▼────┐              (maxSpawnDepth > 1)
  │SubAgt3│
  │(dep 2)│
  └───────┘

通信: sessions_send (A2A) / subagents (list/steer/kill) / auto-announce (push)
注册: SubagentRegistry (Map + disk persistence)
生命周期: start → running → end/error/killed/timeout → announce → cleanup
```
