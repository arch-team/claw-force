# ClawForce — 基于 OpenClaw 的 AI 员工平台

**项目名称**: ClawForce
**口号**: "Your AI Workforce, Unleashed"

---

## Context

**问题**: 企业管理者需要像管理真实团队一样创建、配置和管理 AI 员工，但现有工具要么是面向技术用户的 AI 助手（OpenClaw），要么是缺乏团队协作能力的 Agent 框架（CrewAI/AutoGen）。

**愿景**: 基于 OpenClaw 的多渠道、多 Agent、Skills 体系，叠加企业级管理能力（角色权限、流程引擎、管理后台），构建面向企业管理者的 AI 员工平台。

**首个场景**: AI 开发团队（PM + Developer + QA 协作完成软件开发任务）。

**可复用资产**:
- **OpenClaw**: Gateway 控制面、多 Agent 路由、Skills/ClawHub、多渠道（含飞书）、内存/向量搜索、SubAgent 编排
- **ai-agents-platform**: DDD + Modular Monolith + Clean Architecture 模式、Session 工作流、Eval Pipeline
- **devpace**: BR→PF→CR 价值链、质量门禁、跨会话持续性、BizDevOps 方法论

---

## Phase 1: OpenClaw 技术深度剖析 (Week 1-3)

### 目标
搞清楚 OpenClaw 的可扩展性边界——哪些能复用、哪些需扩展、哪些需重建。

### 关键调研活动

**1.1 核心模块追踪** — Clone 并运行 OpenClaw，追踪消息全生命周期：

| 模块 | 重点文件 | 调研目标 |
|------|---------|---------|
| `src/gateway/` (197 files) | `server-methods.ts`, `role-policy.ts`, `method-scopes.ts` | RBAC 注入点、RPC 扩展机制 |
| `src/agents/` (443 files) | `system-prompt.ts`, `subagent-spawn.ts`, `subagent-registry.ts` | 员工身份注入、团队协作编排 |
| `src/routing/` (10 files) | `resolve-route.ts`, `bindings.ts` | 组织层级路由扩展可行性 |
| `src/memory/` (86 files) | `manager.ts`, vector search 实现 | 角色级/组织级记忆分区 |
| `src/plugin-sdk/` (36 files) | 插件契约、Auth 层、Webhook | Admin UI 集成方式 |
| `extensions/feishu/` | `openclaw.plugin.json`, 适配器实现 | 新渠道适配器的开发模式 |

**1.2 扩展点评估** — 7 个扩展点的企业化适配度评分：
- Extension channels、Skills/ClawHub、Plugin SDK、Webhooks、Node Protocol、Multi-agent routing、Cron/Scheduling

**1.3 国内生态现状盘点**:
- 已有: 飞书、Qwen (OAuth)、VolcEngine/Doubao
- 缺失: 企业微信、钉钉、DeepSeek、通义千问 API、国内云部署

### 交付物
1. OpenClaw 架构图（50 个 src/ 模块关系 + 企业扩展点标注）
2. 复用 vs 重建矩阵（每个子系统评分: 原样复用 / 扩展 / 包装 / 重建）
3. 国内生态差距报告（具体适配器 + 工作量估算）

---

## Phase 2: 竞品分析与模式挖掘 (Week 2-4, 与 Phase 1 重叠)

### 目标
提炼最佳实践模式，明确差异化定位。

### 关键调研对象

| 平台 | 关注重点 |
|------|---------|
| **Coze (字节)** | 国内化设计、可视化工作流构建器、多 Bot 管理、非技术用户 UX |
| **Dify** | 开源架构对比、工作流编排、RAG Pipeline、多模型支持 |
| **CrewAI** | 角色化 Agent 团队、Process 类型、Task 委派（最接近 AI 员工概念） |
| **MetaGPT** | 软件团队模拟（PM/Arch/Dev/QA）、SOP 驱动（直接对标 AI Dev Team） |
| **AutoGen** | 多 Agent 会话模式、GroupChat、角色化 Agent |
| **LangGraph** | 图工作流、状态管理、Human-in-the-loop |
| **Salesforce Agentforce** | 企业级 AI 员工概念、Admin UI 模式 |
| **Copilot Studio** | 低代码 Agent 构建器、审批工作流 |

### 交付物
1. 竞品分析矩阵（8 平台 x 12 维度）
2. 可复用模式目录（工作流定义语言、Agent 协作协议、权限模型、非技术用户 UI 模式）
3. 差异化定位分析

---

## Phase 3: 产品架构设计 (Week 4-6)

### 目标
设计从 "AI 助手" 到 "AI 员工" 的概念模型和系统架构。

### 关键设计活动

**3.1 概念模型**:
```
Organization → Department → Team
  ├── Manager (Human) — 通过 Admin UI / IM 渠道管理
  └── AI Employee (extends OpenClaw Agent)
       ├── Role Definition (岗位描述、职责)
       ├── Skill Set (来自 ClawHub + 企业 Skill 库)
       ├── Work Memory (角色级长期记忆)
       ├── KPI Dashboard (绩效指标)
       ├── Task Board (任务看板)
       └── Growth Trajectory (能力成长轨迹)
```

**3.2 三层架构策略**:
```
┌─────────────────────────────────┐
│       Enterprise Admin UI       │  NEW - React + Ant Design 5
├─────────────────────────────────┤
│       Enterprise API Layer      │  NEW - 参考 ai-agents-platform DDD 架构
├─────────────────────────────────┤
│         OpenClaw Core           │  FORK - 最小差异扩展
└─────────────────────────────────┘
```

**3.3 MVP 深度设计 — AI 开发团队**:

| AI 员工 | 角色 | OpenClaw 映射 | 协作流程 |
|---------|------|-------------|---------|
| PM Agent | 产品经理 | 主 Agent + 路由优先级 | 接收任务 → 分解 → 分配 → 汇总报告 |
| Dev Agent | 开发工程师 | SubAgent (PM 生成) | 接收开发任务 → 编码 → 提交 → 汇报 |
| QA Agent | 测试工程师 | SubAgent (PM 生成) | 接收测试任务 → 验证 → Bug 报告 |

协作基于 OpenClaw 已有的 `sessions_send` 跨 Agent 通信 + `subagent-spawn` 编排。

### 交付物
1. 产品架构文档（实体模型、用户旅程图、系统上下文图）
2. 架构决策记录 (ADRs)
3. 数据模型 ER 图
4. AI 开发团队蓝图（Agent 配置、协作协议、质量门禁）
5. 管理后台低保真线框图

---

## Phase 4: 技术方案设计 (Week 5-8, 与 Phase 3 重叠)

### 关键技术决策

| 决策项 | 推荐方案 | 理由 |
|--------|---------|------|
| Enterprise API 技术栈 | Node.js (TypeScript) 或 FastAPI | 与 OpenClaw 同栈降低认知成本，或复用 ai-agents-platform FastAPI 经验 |
| Admin UI | React 19 + Ant Design 5 + Vite | 国内企业级组件库首选 |
| 工作流引擎 | 自定义 JSON DSL + 可视化设计器 (React Flow / AntV X6) | 比 BPMN 轻量，OpenClaw 的 Cron + Webhook + SubAgent 提供原语 |
| 数据库 | PostgreSQL (企业层) + SQLite (OpenClaw 层) | 企业可靠性 + 保持 OpenClaw 兼容 |
| 实时通信 | WebSocket (连接 Enterprise API + OpenClaw Gateway) | 任务进度、Agent 状态、聊天 |
| 图表 | Apache ECharts | 国内企业仪表盘首选 |
| OpenClaw 集成 | WebSocket Client → Gateway RPC + 配置管理 | 最小侵入式集成 |

### OpenClaw Fork 策略
1. **最小差异 Fork** — 只修改必须改的文件
2. **扩展优先** — 新增文件（新渠道、新模型）优于修改现有文件
3. **上游贡献** — 通用改进（飞书增强、钉钉适配器、国产模型）回馈社区
4. **版本锁定** — Pin 到特定 Release，每季度合并上游

### 交付物
1. 完整系统架构图
2. API 规范 (OpenAPI 3.1)
3. 数据库 DDL
4. OpenClaw 集成规范
5. 工作流引擎技术设计（JSON DSL 语法、执行语义）
6. 国内生态适配器规范
7. 安全设计（SSO、RBAC、数据隔离、审计日志）

---

## Phase 5: PRD 与路线图 (Week 7-9)

### PRD 文档体系（复用 devpace 文档模式）

| 文档 | 内容 |
|------|------|
| `vision.md` | 北极星、目标用户、价值主张、成功指标 |
| `design.md` | 架构决策、概念模型、UX 原则 |
| `requirements.md` | 用户故事、验收标准 |
| `roadmap.md` | 分阶段交付里程碑 |
| `progress.md` | 实施跟踪 |

### 实施路线图

| 阶段 | 时长 | 里程碑 |
|------|------|--------|
| **M1: 基础搭建** | 第 1-2 月 | OpenClaw Fork 运行 + Enterprise API 骨架 + Admin UI Shell |
| **M2: AI 开发团队 MVP** | 第 2-4 月 | PM+Dev+QA 协作完成真实任务、基础任务看板 |
| **M3: 企业功能** | 第 4-6 月 | 工作流引擎、审批链、绩效仪表盘、RBAC |
| **M4: 国内生态** | 第 5-7 月 (并行) | 钉钉/企业微信/飞书 + 国产 LLM + 国内云部署 |
| **M5: 生产就绪** | 第 7-9 月 | 多租户、审计日志、SSO、监控 |

### 风险清单

| 风险 | 缓解策略 |
|------|---------|
| OpenClaw 上游 Breaking Changes | Pin 版本 + 最小差异 Fork + 贡献上游 |
| SQLite 记忆层企业级扩展性 | 早期规划 PostgreSQL 迁移路径 |
| 国产 LLM 质量差异 | 多模型 Failover (OpenClaw 已支持) + 基准测试套件 |
| 非技术用户采纳 | 投入 UX 研究 + 真实用户早期迭代 |

---

## 验证方式

1. **Phase 1 验证**: 本地成功运行 OpenClaw Fork，能通过飞书发消息并收到回复
2. **Phase 2 验证**: 竞品分析矩阵覆盖 8+ 平台，每个维度有具体数据支撑
3. **Phase 3 验证**: 架构设计通过 devpace 质量门禁（Gate 1 设计评审）
4. **Phase 4 验证**: 技术方案能回答所有关键实现问题，无遗留 TBD 项
5. **Phase 5 验证**: PRD 完整度 ≥90%，路线图每个阶段有明确交付物和验收标准
