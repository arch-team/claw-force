# OpenClaw Gateway 与 Routing 模块深度分析

## 一、系统架构概览

OpenClaw 的 Gateway 是整个系统的核心通信枢纽，同时承担以下职责：
- **WebSocket 服务端**：接收 CLI 客户端、Web UI（Control UI）、移动端节点的 WS 连接
- **HTTP 服务端**：处理 Hooks、OpenAI 兼容接口、Slack HTTP 回调、Canvas、Control UI 静态资源
- **Channel 生命周期管理**：管理 Telegram、Discord、Slack、WhatsApp 等多渠道的启停和重连
- **RPC 分发引擎**：通过 JSON-RPC 风格的消息帧进行方法路由和权限控制

---

## 二、Gateway 入口分析

### 2.1 服务启动主函数

**核心文件**：`src/gateway/server.impl.ts`

`startGatewayServer(port, opts)` 是整个 Gateway 的启动入口。启动流程：

1. **配置加载与迁移**：`readConfigFileSnapshot()` → `migrateLegacyConfig()`
2. **Secrets 激活**：`activateRuntimeSecrets()` 解析和激活运行时密钥
3. **Auth 引导**：`ensureGatewayStartupAuth()` 确保有效认证配置
4. **模型目录加载**：`loadGatewayModelCatalog`
5. **插件系统初始化**：
   - `loadGatewayPlugins()` 加载插件，注入 `gatewayHandlers` 和 `gatewayMethods`
   - Channel 插件也可以贡献 gateway methods
6. **HTTP/WS 服务创建**：
   - `createGatewayRuntimeState()` 创建 HTTP Server + WebSocketServer + 运行时状态
   - `attachGatewayWsHandlers()` 绑定 WS 消息处理
   - `attachGatewayUpgradeHandler()` 处理 HTTP → WS 升级
7. **Sidecar 启动**：浏览器控制服务、Gmail Watcher、内部 Hooks、Channel 启动、插件服务

### 2.2 RPC 方法定义

**核心文件**：`src/gateway/server-methods-list.ts`

系统预定义约 **90+ 个 RPC 方法**：

| 类别 | 方法示例 | 说明 |
|------|---------|------|
| 健康/状态 | `health`, `status`, `doctor.memory.status` | 系统健康检查 |
| 聊天/对话 | `chat.send`, `chat.abort`, `chat.history` | WebChat 实时对话 |
| Agent 调度 | `agent`, `agent.wait`, `agent.identity.get` | Agent 执行和等待 |
| 消息发送 | `send`, `poll` | 向渠道发送消息/投票 |
| 配置管理 | `config.get`, `config.set`, `config.apply`, `config.patch` | 运行时配置 |
| 会话管理 | `sessions.list`, `sessions.preview`, `sessions.reset` | 会话生命周期 |
| 节点管理 | `node.pair.*`, `node.invoke`, `node.event` | 远程节点配对和调用 |
| 技能管理 | `skills.status`, `skills.bins`, `skills.install` | 技能安装和状态 |
| 定时任务 | `cron.list`, `cron.add`, `cron.run` | 定时调度 |
| 浏览器 | `browser.request` | 浏览器自动化 |

方法注册机制支持动态扩展：
```typescript
const channelMethods = listChannelPlugins().flatMap((plugin) => plugin.gatewayMethods ?? []);
const pluginMethods = Object.keys(pluginRegistry.gatewayHandlers);
const gatewayMethods = Array.from(new Set([...baseMethods, ...pluginMethods, ...channelMethods]));
```

方法处理器在 `src/gateway/server-methods.ts` 中通过 `coreGatewayHandlers` 聚合 20+ 个 handler 模块。插件处理器优先于核心处理器（可覆盖）。

### 2.3 权限控制体系

#### 第一层：Role Policy（角色策略）

**文件**：`src/gateway/role-policy.ts`

两种角色：
- `operator`：操作员，可调用除 node 专属方法外的所有方法
- `node`：远程节点，只能调用 4 个方法

#### 第二层：Scope Policy（权限范围策略）

**文件**：`src/gateway/method-scopes.ts`

五个操作员权限范围：

| Scope | 作用 |
|-------|------|
| `operator.admin` | 全权管理 |
| `operator.read` | 只读查询 |
| `operator.write` | 写入操作 |
| `operator.approvals` | 审批操作 |
| `operator.pairing` | 配对管理 |

认证方式级联执行：
1. health 方法跳过认证
2. 解析角色（operator/node）
3. 角色级权限检查
4. admin scope 直接通过
5. 精确 scope 检查

#### 第三层：Control Plane 写限速

对 `config.apply`、`config.patch`、`update.run` 实施速率限制（3次/60秒）。

### 2.4 WebSocket 端点

**文件**：`src/gateway/server/ws-connection.ts`

WS 连接生命周期：连接建立 → Challenge 发送 → 握手超时 → 消息处理 → 断开清理

### 2.5 HTTP 端点

**文件**：`src/gateway/server-http.ts`

HTTP 请求处理链：
1. Hooks 请求 (`/hooks/*`)
2. Tools Invoke (`POST /tools/invoke`)
3. Slack HTTP
4. Plugin 路由
5. OpenResponses (`POST /v1/responses`)
6. OpenAI Chat Completions (`POST /v1/chat/completions`)
7. Canvas
8. Control UI

认证方式：`none` / `token` / `password` / `trusted-proxy` / `tailscale`

---

## 三、Routing 机制分析

### 3.1 路由解析核心

**文件**：`src/routing/resolve-route.ts`

`resolveAgentRoute()` 输入：
```typescript
type ResolveAgentRouteInput = {
  cfg: OpenClawConfig;
  channel: string;           // 渠道名
  accountId?: string;        // Bot 账号 ID
  peer?: RoutePeer;          // 对话对端
  parentPeer?: RoutePeer;    // 父级对端（线程继承）
  guildId?: string;          // Discord guild ID
  teamId?: string;           // Slack team ID
  memberRoleIds?: string[];  // 成员角色 ID 列表
};
```

输出：`agentId` + `channel` + `accountId` + `sessionKey` + `matchedBy`

### 3.2 分层匹配策略（7 Tiers）

| 层级 | 匹配名 | 说明 |
|------|--------|------|
| 1 | `binding.peer` | 最精确：绑定到特定用户/群组 |
| 2 | `binding.peer.parent` | 线程继承 |
| 3 | `binding.guild+roles` | Discord: Guild + 成员角色 |
| 4 | `binding.guild` | Discord: Guild |
| 5 | `binding.team` | Slack: Team |
| 6 | `binding.account` | Bot 账号 |
| 7 | `binding.channel` | 整个渠道默认 |
| fallback | `default` | 默认 Agent |

### 3.3 Agent 绑定配置

**文件**：`src/routing/bindings.ts` + `src/config/types.agents.ts`

```typescript
type AgentBinding = {
  agentId: string;
  match: {
    channel: string;
    accountId?: string;
    peer?: { kind: ChatType; id: string };
    guildId?: string;
    teamId?: string;
    roles?: string[];
  };
};
```

### 3.4 Session Key 构建

**文件**：`src/routing/session-key.ts`

| dmScope | Session Key 格式 | 隔离粒度 |
|---------|-----------------|---------|
| `main` | `agent:{agentId}:main` | 所有 DM 共享 |
| `per-peer` | `agent:{agentId}:direct:{peerId}` | 每对话者独立 |
| `per-channel-peer` | `agent:{agentId}:{channel}:direct:{peerId}` | 每渠道每对话者 |
| `per-account-channel-peer` | `agent:{agentId}:{channel}:{accountId}:direct:{peerId}` | 最细粒度 |

支持 `identityLinks` 跨渠道身份关联。

---

## 四、企业化扩展潜力分析

### 4.1 RBAC 注入点

| 注入点 | 位置 | 扩展方式 | 改动成本 |
|--------|------|---------|---------|
| `authorizeGatewayMethod()` | `server-methods.ts` | 在 role/scope 检查间插入 orgPolicy 层 | 低 |
| 角色系统 | `role-policy.ts` | 增加 admin/viewer/department-admin 等角色 | 低 |
| Scope 体系 | `method-scopes.ts` | 静态字典改为配置驱动 + 动态 scope | 中 |
| WS 连接参数 | `ConnectParams` | 握手时注入 orgId/deptId/userId | 低 |

### 4.2 路由层组织/部门层级扩展

**完全可行，改动面可控：**

1. **路由输入扩展**：已有 `guildId`/`teamId` 概念，增加 `organizationId`/`departmentId`
2. **绑定匹配扩展**：增加 `binding.organization`/`binding.department` 层级
3. **Session Key 扩展**：`agent:{agentId}:{orgId}:{deptId}:{channel}:{peerKind}:{peerId}`
4. **多租户**：`accountId` 语义扩展或并行添加 `tenantId`

### 4.3 RPC 方法扩展机制

已有完善的插件化扩展：
- **Plugin Gateway Handlers**：插件注册 `gatewayHandlers`，优先于核心处理器
- **Channel Plugin Methods**：渠道插件贡献 gateway methods
- **Hook Mappings**：HTTP 请求映射为内部 Agent/Wake 动作

**企业扩展建议**：
1. 中间件链模式（pre/post 处理器：审计日志、权限检查、限速）
2. 方法命名空间（`org.users.list` 区分企业级方法）
3. 请求上下文扩展（携带 organizationId/userId）
4. 方法级细粒度限速（每用户/组织独立）

---

## 五、消息完整流转路径

### 外部渠道消息路径
```
[外部渠道: Discord/Telegram/Slack/WhatsApp]
  → [Channel Plugin] startAccount()
  → [dispatchInboundMessage()] 消息入站
  → [resolveAgentRoute()] 7层路由匹配
  → [agentCommand()] Agent 执行
  → [routeReply()] 回复路由
  → [deliverOutboundPayloads()] 发送到原始渠道
```

### WebSocket RPC 路径
```
[WS Client 连接]
  → [connect.challenge] nonce
  → [connect] 认证 (token/password/tailscale/trusted-proxy)
  → [RPC 请求帧] {type: "req", method, params}
  → [handleGatewayRequest()]
    → authorizeGatewayMethod() 权限
    → consumeControlPlaneWriteBudget() 限速
    → handler 查找与执行
```

### HTTP Hooks 路径
```
[HTTP POST /hooks/agent]
  → [createHooksRequestHandler()]
    → token 认证
    → 速率限制
    → /hooks/wake | /hooks/agent | /hooks/{custom}
    → agentCommand()
```

---

## 六、ClawForce 扩展评估

| 维度 | 评分 | 说明 |
|------|------|------|
| RBAC 扩展性 | ⭐⭐⭐⭐ | 权限模型清晰，注入点明确，改动成本低 |
| 组织层级路由 | ⭐⭐⭐⭐ | 已有类似概念（guild/team），扩展自然 |
| RPC 方法扩展 | ⭐⭐⭐⭐⭐ | 插件化机制完善，支持动态注册和覆盖 |
| 多租户支持 | ⭐⭐⭐ | 需要在 Session Key 和配置层面增加租户隔离 |
| 认证集成 | ⭐⭐⭐⭐ | 支持多种认证方式，可扩展 SSO |
| 审计日志 | ⭐⭐ | 无内置审计，需通过中间件链添加 |
