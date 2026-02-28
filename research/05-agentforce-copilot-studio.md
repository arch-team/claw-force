# Salesforce Agentforce vs Microsoft Copilot Studio -- 深度竞品分析

> **目标**: 为企业级 AI 员工平台 ClawForce 提供竞品调研参考
> **分析日期**: 2026-02-28
> **数据来源**: Salesforce 官方文档、Microsoft Learn、产品定价页、合规门户

---

## 概览对比

| 维度 | Salesforce Agentforce | Microsoft Copilot Studio |
|------|----------------------|--------------------------|
| **母公司** | Salesforce (CRM 巨头) | Microsoft (全栈科技巨头) |
| **前身** | Einstein Bots + Salesforce Flow | Power Virtual Agents (PVA) |
| **定位** | CRM 原生 AI Agent 平台 / "Digital Labor" | 低代码 AI Agent 构建器 / Microsoft 365 扩展 |
| **核心引擎** | Atlas Reasoning Engine | Azure OpenAI + Generative Orchestration |
| **主要用户群** | Salesforce 生态客户 | Microsoft 365 / Power Platform 用户 |
| **市场渗透** | "数千家企业"使用 | 宣称 90% Fortune 500 使用 |

---

## 1. 架构模式

### Salesforce Agentforce

**整体架构**: Agentforce 360 Platform，围绕五大支柱构建:

1. **Embed Anywhere** -- 全渠道嵌入
2. **Supervise & Optimise** -- 监督与优化
3. **Agents for Any Usecase** -- 通用 Agent 支持
4. **Build & Test Fast** -- 快速构建测试
5. **Deep Data Integration** -- 深度数据集成

**核心概念**:

- **Atlas Reasoning Engine**: Agentforce 的核心智能引擎，采用三阶段推理:
  - **Understanding (理解)**: 解析用户意图和问题范围
  - **Deciding (决策)**: 确定所需数据和所需操作
  - **Executing (执行)**: 自主执行操作直到任务完成
  - 引擎会将初始 prompt 分解为更小的任务，在每个步骤进行评估，直到答案或操作完全实现

- **Agentforce Script**: 混合推理引擎，将确定性工作流与灵活的 LLM 推理配对。必需的业务逻辑始终按序列运行，而 LLM 推理处理细微差别

- **Topics & Actions 模型**:
  - **Topics**: 定义 Agent 应处理的范围（相当于能力域）
  - **Actions**: Agent 可选择的操作库（调用 Flows、Apex、MuleSoft API、JavaScript 等）
  - 通过自然语言指令在 Topic 内引导 Agent 行为

**与母平台关系**: 深度绑定 Salesforce CRM 生态。Agent 基于 CRM 数据、Data 360、MuleSoft 集成运行。Einstein 原生嵌入平台，利用 CRM 和外部应用数据提供洞察、预测和生成内容。

**架构层次**:
```
Agentforce Builder (构建层)
  -> Agentforce Script (混合推理层)
  -> Atlas Reasoning Engine (智能引擎层)
  -> Einstein Trust Layer (安全信任层)
  -> Data 360 / CRM Data (数据层)
  -> Hyperforce Infrastructure (基础设施层)
```

### Microsoft Copilot Studio

**整体架构**: 基于 Power Platform 的低代码 Agent 构建平台，属于 Microsoft 365 Copilot 扩展生态。

**核心概念**:

- **Agent 365**: 控制面板层，将 Microsoft 365 的基础设施、应用和保护扩展到 Agent 场景
- **Work IQ**: 智能层，为 Microsoft 365 Copilot 和 Agent 提供用户、岗位、公司理解
- **Generative Orchestration（生成式编排）**: 新一代编排引擎，Agent 使用生成式 AI 自动选择最佳的 Topics、Tools、Knowledge 和其他 Agents 组合来回答查询
  - 与 Classic Orchestration（基于 trigger phrase 匹配）对比: Generative 模式下 Agent 可同时使用多个 Topics、Tools、Knowledge；自动生成问题收集缺失信息；自动生成响应
- **Agent Flows**: 自动化工作流，可由手动、事件、其他 Agent 或定时触发

**Topics 与触发机制**:
- **Generative 模式**: Agent 基于 Topic 的 description 进行选择（语义匹配）
- **Classic 模式**: 基于 trigger phrases 进行 NLU 意图匹配
- **节点类型**: Message、Question、Adaptive Card、Condition、Variable Management、Topic Management、Tool（Power Automate/Connector）、HTTP Request、Generative Answers

**与母平台关系**: 深度绑定 Microsoft 365 + Power Platform + Azure 生态。Agent 可直接部署到 Teams、SharePoint、Microsoft 365 Copilot。通过 Power Automate 实现流程自动化，通过 Azure Bot Service 扩展渠道。

**架构层次**:
```
Copilot Studio Web App / Teams App (构建层)
  -> Generative / Classic Orchestration (编排层)
  -> Azure OpenAI + GPT Models (智能引擎层)
  -> Power Platform Governance (治理层)
  -> Microsoft Graph / Dataverse (数据层)
  -> Azure Infrastructure (基础设施层)
```

### ClawForce 启示

| 方面 | Agentforce 经验 | Copilot Studio 经验 | ClawForce 建议 |
|------|----------------|---------------------|----------------|
| 推理引擎 | 自研 Atlas，三阶段推理 | 依赖 Azure OpenAI，双模式编排 | 建议支持可插拔推理引擎 |
| 概念模型 | Topics + Actions | Topics + Tools + Knowledge | 采用类似的 "能力域 + 操作" 分层模型 |
| 平台绑定 | 强绑定 CRM | 强绑定 M365 | ClawForce 应保持平台无关性 |

---

## 2. 多 Agent 协作

### Salesforce Agentforce

- **Multi-Agent Orchestration**: 作为平台级功能支持多 Agent 协同工作
- **协调机制**: Agent 可跨所有渠道执行操作，集成到任何系统中
- **升级机制**: 当 Agent 遇到超出其范围的复杂问题时，可将问题升级给人工 Agent
- **预构建 Agent 类型**: 提供 7+ 种预构建 Agent（Service Agent、SDR、Sales Coach、Merchandiser、Buyer Agent、Personal Shopper、Campaign Optimizer），各 Agent 有明确的职能分工
- **AgentExchange**: Agent 操作和模板的市场，支持跨 Agent 共享可复用的 Actions
- **行业覆盖**: 14+ 行业的专用 Agent 模板

**技术细节**: Agent 间协作通过 Agentforce 360 Platform 统一编排，共享同一数据层（CRM + Data 360），Atlas Reasoning Engine 负责跨 Agent 的任务路由和协调。

### Microsoft Copilot Studio

- **Multi-Agent Orchestration**: 支持将任务路由到正确的 Agent（当需要专业知识时）
- **Child Agents / Connected Agents**: Agent 可以调用其他 Agent 作为子 Agent
- **Generative Orchestration 模式下**: Agent 可基于描述自动选择 child agents 和 connected agents
- **Agent Store**: 提供预构建 Agent 模板和来自 Microsoft 或合作伙伴的 Agent
- **Agent 间通信**: 通过 Copilot Studio 的编排层实现，Agent 可将自身作为其他 Agent 的扩展
- **Microsoft 365 Copilot 集成**: Agent 可作为 Microsoft 365 Copilot 的 declarative agent 运行

**技术细节**: Generative Orchestration 中，Agent 通过 description 驱动的语义选择来路由到 child/connected agent。每个 Agent 的 description 是选择的最重要因素。

### 对比

| 能力 | Agentforce | Copilot Studio |
|------|-----------|----------------|
| 多 Agent 编排 | 平台级原生支持 | 支持，通过 Generative Orchestration |
| Agent 间路由 | Atlas Engine 统一协调 | 基于 description 语义选择 |
| 预构建 Agent | 7+ 种职能 Agent | Agent Store + 预构建模板 |
| 人机升级 | 原生支持 | 支持 handoff to live agent |
| Agent 市场 | AgentExchange | Agent Store |
| 第三方 Agent | MCP 支持 + AgentExchange | 合作伙伴 Agent 集成 |

---

## 3. 工作流/流程引擎

### Salesforce Agentforce

- **Salesforce Flows**: 原生流程引擎，Agent 的 Actions 可直接调用 Flows
- **Agentforce Script**: 混合推理，确定性工作流序列 + LLM 灵活推理
- **Apex 集成**: 支持 Apex 代码编写复杂业务逻辑
- **MuleSoft 集成**: 通过 MuleSoft API 连接任意外部系统
- **触发机制**: Agent 可通过自服务门户、消息渠道、语音等多渠道触发
- **审批工作流**: 通过 Salesforce Flow 原生支持，深度集成 Salesforce 的 Approval Process

**优势**: Flow 作为 Salesforce 生态的核心自动化引擎，已有庞大的模板库和企业级验证。Agent 天然可以利用现有的 Flow 资产。

### Microsoft Copilot Studio

- **Agent Flows (Power Automate)**: 直接集成 Power Automate，支持:
  - 手动触发
  - 事件驱动触发
  - Agent 触发
  - 定时触发
- **Power Automate 流程**: 支持 Automated flows、Instant flows、Scheduled flows（需 standalone 订阅）
- **审批工作流**: 通过 Power Automate 的 Approvals connector 实现，原生集成 Teams 审批
- **触发机制**:
  - Generative 模式: 基于语义描述自动路由
  - Classic 模式: 基于 trigger phrases
  - 事件触发: 响应外部事件自主行动
- **节点系统**: 丰富的可视化节点 -- Message、Question、Adaptive Card、Condition、Variable Management、Tool 等
- **YAML 代码编辑器**: 支持通过 YAML 直接编辑 Topic 的会话流程

**优势**: Power Automate 是企业自动化领域的领导者，1400+ connectors 生态提供了丰富的集成能力。Agent Flows 可独立运行或被 Agent 调用。

### 对比

| 能力 | Agentforce | Copilot Studio |
|------|-----------|----------------|
| 流程引擎 | Salesforce Flows | Power Automate |
| 混合推理 | Agentforce Script | Generative Orchestration |
| 代码扩展 | Apex + JavaScript | YAML + C# (Bot Framework) |
| 审批工作流 | 原生 Approval Process | Power Automate Approvals |
| API 集成 | MuleSoft | 1400+ Power Platform Connectors |
| 可视化编辑 | Agent Builder Canvas | Authoring Canvas + YAML Editor |
| 触发类型 | 渠道触发 + Flow 触发 | 语义/短语/事件/定时触发 |

---

## 4. 权限与 RBAC

### Salesforce Agentforce

- **Salesforce 权限模型**: 继承 Salesforce 平台成熟的企业级权限体系:
  - **Profiles**: 用户配置文件，定义对象、字段、页面的访问权限
  - **Permission Sets**: 细粒度权限集，可叠加授予
  - **Roles & Role Hierarchy**: 角色层级，控制数据可见性
  - **Sharing Rules**: 记录级共享规则
  - **Field-Level Security**: 字段级安全控制
- **多租户**: Salesforce 原生多租户架构，每个组织是独立的 Tenant
- **Agent 级权限**:
  - Agent Guardrails: 用户定义的安全护栏 + Salesforce 托管保护
  - 默认开启，管理员可轻松配置
  - 防止偏离指令、阻止离题对话、缓解幻觉和偏见
- **Einstein Trust Layer**:
  - 动态 grounding（基于受信业务数据）
  - Zero data retention（与 LLM 零数据保留）
  - 毒性检测
  - 隐私和安全保护
- **Shield Platform Encryption**: 企业级加密，支持自带密钥（BYOK）
- **共享责任模型**: 内置安全控制 + 客户可配置的额外安全方案

### Microsoft Copilot Studio

- **Power Platform 治理模型**:
  - **Data Loss Prevention (DLP)**: 数据策略控制 Agent 功能和能力的使用
  - **Environment Routing**: 管理员可配置环境路由，为构建者提供安全空间
  - **Maker/User Authentication**: 多级身份验证控制
- **Entra ID (Azure AD) 集成**:
  - 支持 SSO
  - 证书认证
  - Manual authentication 配置
- **Admin Controls**:
  - Power Platform Admin Center 统一管理
  - 控制 Agent 创建、共享、发布
  - 禁用 generative AI 发布能力
  - Maker 安全警告（发布前安全扫描）
  - Maker 欢迎消息（合规要求通知）
- **审计与监控**:
  - Microsoft Purview 审计日志
  - Microsoft Sentinel 监控和告警
  - Agent runtime 保护状态可视化
- **数据保护**:
  - Customer Managed Keys (CMK) 支持
  - Sensitivity Labels（SharePoint 数据源敏感度标签）
  - Customer Lockbox 支持
  - Geographic Data Residency
- **Autonomous Agent 治理**: 通过数据策略管理触发器能力，防止数据泄露

### 对比

| 能力 | Agentforce | Copilot Studio |
|------|-----------|----------------|
| RBAC 模型 | Profiles + Permission Sets + Roles | Entra ID + Power Platform Roles |
| 多租户 | 原生多租户 | Azure AD / Power Platform Environments |
| 数据加密 | Shield Platform Encryption (BYOK) | Customer Managed Keys (CMK) |
| Agent 安全护栏 | Einstein Trust Layer + Guardrails | DLP + Data Policies + Security Scan |
| 审计日志 | Salesforce Audit Trail | Microsoft Purview + Sentinel |
| 零数据保留 | LLM Zero Data Retention | 遵循 Microsoft Product Terms |
| 合规认证数量 | 极其丰富（见第 10 节） | 依赖 Azure/M365 合规认证 |

---

## 5. 非技术用户 UX

### Salesforce Agentforce

- **Agent Builder**: 统一的构建工作空间，将起草、测试、部署整合到一个对话式工作区
  - **文档式编辑器**: 带自动补全
  - **低代码画布**: 可视化流程设计
  - **Pro-code 脚本视图**: 高级开发者使用
- **构建方式**: 定义 Topics -> 编写自然语言指令 -> 创建 Actions 库
- **AI 引导构建**: 通过 AI 引导开始构建，然后通过多种模式细化
- **Agentforce NOW / Agentforce Decoded**: 开发者学习资源
- **Agentblazer Community**: 用户社区和最佳实践

**上手难度**: 中等。虽然提供了低代码工具，但 Salesforce 生态的学习曲线较陡（需要理解 Salesforce 平台概念如 Objects、Flows 等）。最适合已有 Salesforce 经验的管理员和开发者。

### Microsoft Copilot Studio

- **低代码构建器**: 完全图形化，支持拖拽式节点编辑
  - **自然语言创建**: 用自然语言描述即可创建 Agent
  - **Authoring Canvas**: 可视化对话流编辑
  - **YAML Code Editor**: 进阶用户的代码编辑模式
  - **AI 辅助创建**: 描述需求后 AI 自动构建 Topic
- **模板系统**: Agent Store 提供预构建模板，即选即用
- **双入口**:
  - Web App (copilotstudio.microsoft.com)
  - Teams App（简化版，面向内部 Agent）
- **测试面板**: 内置 Test Panel，实时测试 Agent 响应
- **Activity Map**: Generative 模式下可追踪 Agent 的决策路径
- **22 种语言支持**: 包括中文（简/繁）

**上手难度**: 低。继承 Power Platform 的低代码基因，对非技术用户极为友好。已有 Power Platform 经验的用户可以几分钟内构建基础 Agent。

### 对比

| 能力 | Agentforce | Copilot Studio |
|------|-----------|----------------|
| 构建模式 | 对话式 + 低代码 + Pro-code | 自然语言 + 可视化 + YAML |
| 非技术用户友好度 | 中等（需 SF 背景） | 高（低代码优先） |
| AI 辅助构建 | 有 | 有（描述即创建） |
| 模板数量 | 7+ 预构建 Agent + AgentExchange | Agent Store + 大量模板 |
| 测试工具 | Agent Builder 内置 | Test Panel + Activity Map |
| 语言支持 | 未公开具体数量 | 22 种语言 |
| 学习资源 | Trailhead + Agentblazer | Microsoft Learn + Community |

---

## 6. LLM 模型支持

### Salesforce Agentforce

- **Atlas Reasoning Engine**: Salesforce 自研推理引擎，是模型的抽象层
- **Einstein AI**: 原生嵌入平台的 AI 能力
  - 预测性 AI（预构建模型）
  - 生成式 AI（基于 LLM）
- **LLM 支持**:
  - 与 OpenAI 合作（Azure OpenAI 引用在合规文档中）
  - 支持 MCP (Model Context Protocol) 连接外部模型和工具
  - ISO 42001:2023 AI 管理系统认证
  - 专用 Model Cards 覆盖 Einstein 各模型
- **自带 AI 能力**:
  - Einstein Copilot 内嵌于各 Cloud 产品
  - 预构建的行业 AI 模型
  - Prompt Builder 自定义提示词

**模型透明度**: 较低。Atlas Engine 作为黑盒封装，用户主要通过 Topics/Actions 配置行为，而非直接选择或配置底层模型。

### Microsoft Copilot Studio

- **多模型支持**:
  - **GPT-5**: 已在平台中可用
  - **Anthropic**: 加入 Copilot Studio 多模型阵列
  - **Azure OpenAI**: 核心 AI 引擎
  - 支持选择不同的 language models 和 orchestration
- **AI 能力**:
  - Generative Orchestration（生成式编排）
  - NLU 意图理解
  - 自动生成响应
  - 自动生成问题收集缺失信息
  - 基于会话上下文的自适应推理
- **Work IQ**: 微软 365 智能层，理解用户、岗位、公司
- **Computer Use Tool**: 支持 Agent 操控计算机界面（新功能）

**模型透明度**: 中等。用户可在一定程度上选择模型，且 Microsoft 公开支持的模型列表。

### 对比

| 能力 | Agentforce | Copilot Studio |
|------|-----------|----------------|
| 核心推理引擎 | Atlas Reasoning Engine (自研) | Azure OpenAI (GPT-5, Anthropic) |
| 多模型支持 | 有限（MCP 扩展） | 明确支持多模型 |
| 模型可选性 | 低（黑盒封装） | 中等（可选模型和编排方式） |
| AI 管理认证 | ISO 42001:2023 | 遵循 Microsoft Responsible AI |
| 自带预测 AI | Einstein 预构建模型 | Work IQ 智能层 |
| AI 透明度 | Model Cards 公开 | Responsible AI 原则公开 |

---

## 7. 渠道/集成生态

### Salesforce Agentforce

- **CRM 集成**: 原生深度集成 Salesforce 全家桶:
  - Sales Cloud
  - Service Cloud
  - Marketing Cloud
  - Commerce Cloud
  - Field Service
  - Data 360
  - 14+ 行业 Cloud
- **集成工具**:
  - **MuleSoft**: 企业级 API 集成平台（Salesforce 旗下）
  - **MCP (Model Context Protocol)**: 连接外部数据和第三方平台
  - **Flows**: 跨系统自动化
  - **AgentExchange**: 预构建 Agent Actions 和模板市场
- **渠道支持**:
  - 自服务门户
  - 消息渠道（SMS、WhatsApp 等）
  - Agentforce Voice（电话/Web/移动端语音 -- 初始支持美国和加拿大）
  - Web 聊天
  - 移动应用嵌入
- **API**: REST API、SOAP API、Bulk API、Streaming API 等 Salesforce 标准 API

### Microsoft Copilot Studio

- **Microsoft 生态集成**:
  - Microsoft Teams（原生深度集成）
  - SharePoint
  - Microsoft 365 Copilot
  - Dynamics 365
  - Power Platform (Power Apps, Power Automate, Power BI)
  - Azure
  - Microsoft Purview
  - Viva Insights
- **Connectors 生态**:
  - **1,400+ 预构建 Connectors**
  - Standard Connectors（含基础版）
  - Premium Connectors（需付费订阅）
  - Custom Connectors（连接任意公开 API）
  - MCP (Model Context Protocol) Servers 支持
- **渠道支持**:
  - Microsoft Teams
  - SharePoint
  - Microsoft 365 Copilot
  - Web 应用
  - Facebook
  - Azure Bot Service 支持的所有渠道
  - 社交媒体渠道
  - 语音 Agent（基于 generative AI）
- **API**: REST API、Bot Framework SDK、Power Platform API

### 对比

| 能力 | Agentforce | Copilot Studio |
|------|-----------|----------------|
| CRM 集成 | 原生 Salesforce CRM（深度） | Dynamics 365（通过 connectors） |
| ERP 集成 | 通过 MuleSoft | Dynamics 365 + 1400+ connectors |
| IM 渠道 | SMS/WhatsApp/Web Chat + Voice | Teams（深度）+ 多渠道 |
| 集成平台 | MuleSoft（旗下产品） | Power Platform Connectors |
| 预构建连接器数量 | MuleSoft 量级（数百） | 1,400+ |
| MCP 支持 | 有 | 有 |
| 市场/应用商店 | AgentExchange | Agent Store |
| 语音能力 | Agentforce Voice（US/CA） | Voice-Enabled Agents |

---

## 8. 记忆/知识库

### Salesforce Agentforce

- **数据源**:
  - Salesforce CRM 数据（实时）
  - Data 360（统一数据管理）
  - External Data（通过 MuleSoft/MCP）
- **Intelligent Context**:
  - 处理复杂、非结构化数据源
  - 低代码管道处理非结构化、多模态数据
  - 大幅减少配置时间
- **Dynamic Grounding**: Einstein Trust Layer 的动态 grounding，基于受信业务数据
- **知识管理**:
  - Salesforce Knowledge（原生知识库）
  - 与 Data 360 集成的企业数据连接
  - Agent 可观察其行动计划并测试响应

**特点**: 知识库与 CRM 数据层深度融合，Agent 天然可以访问客户记录、案例历史、产品信息等结构化数据。

### Microsoft Copilot Studio

- **知识源类型**:
  - **SharePoint**: 组织文档和知识库
  - **Copilot (Graph) Connectors**: 管理员配置的 Microsoft 365 数据源
  - **Web Browsing**: 通过 Bing 搜索公开网络
  - **Power Platform Connectors as Knowledge (Preview)**: 实时数据连接
  - **文件**: Word、PDF、Web Pages 等
- **Sensitivity Labels**: 可显示 SharePoint 数据源的最高敏感度标签
- **Knowledge 搜索行为**:
  - **Generative 模式**: Agent 主动搜索知识回答查询，可组合多个知识源
  - **Classic 模式**: 知识作为 fallback（当无 Topic 匹配时）
- **Microsoft Graph**: 底层通过 Microsoft Graph 访问组织数据

**特点**: 天然与 Microsoft 365 文档生态集成（SharePoint、OneDrive、Graph），非结构化文档理解能力强。

### 对比

| 能力 | Agentforce | Copilot Studio |
|------|-----------|----------------|
| 结构化数据 | CRM 原生（强） | Dataverse + Dynamics 365 |
| 非结构化数据 | Intelligent Context | SharePoint + 文件上传 |
| 企业文档 | Salesforce Knowledge | SharePoint + Graph |
| 外部数据连接 | MuleSoft + MCP + Data 360 | 1400+ Connectors + Graph Connectors |
| 实时数据 | CRM 实时数据 | Power Platform Connectors (Preview) |
| 会话记忆 | Agent 维护对话上下文 | 维护会话历史（有长度限制） |
| 敏感度管理 | Einstein Trust Layer | Sensitivity Labels |
| 网络搜索 | 未明确 | Bing Web Browsing |

---

## 9. 扩展性/插件系统

### Salesforce Agentforce

- **AgentExchange**: 专用市场，提供:
  - 预构建 Agent Actions
  - Agent 模板
  - 来自受信合作伙伴的扩展
- **开发工具**:
  - **Agentforce Dev Tools**: 低代码和 Pro-code 完整开发生命周期
  - **Apex**: Salesforce 专有编程语言
  - **JavaScript**: 前端扩展
  - **MuleSoft API**: 任意系统集成
  - **MCP Support**: Model Context Protocol，连接外部数据和工具
- **扩展模式**:
  - Topics 自定义
  - Actions 自定义（Flow、Apex、API）
  - Prompt Builder 自定义提示词
  - 微前端架构（ASA MFE）

### Microsoft Copilot Studio

- **扩展体系**:
  - **Prebuilt Connectors**: 1400+ 标准/Premium 连接器
  - **Custom Connectors**: 连接任意公开 API
  - **MCP (Model Context Protocol) Servers**: 外部工具和数据连接
  - **REST API Tools**: 直接调用 REST API
  - **Computer Use Tool**: Agent 操控计算机界面
  - **Bot Framework Skills**: 使用 Microsoft Bot Framework 扩展能力
  - **Prompts as Tools**: 将提示词作为工具使用
- **开发模式**:
  - Agent Flows (Power Automate)
  - Custom Connectors (Power Apps portal)
  - YAML Code Editor
  - Bot Framework SDK
- **市场**: Agent Store -- 预构建 Agent 和模板

### 对比

| 能力 | Agentforce | Copilot Studio |
|------|-----------|----------------|
| 插件市场 | AgentExchange | Agent Store |
| 连接器生态 | MuleSoft（企业级） | 1,400+ Connectors（广度优势） |
| MCP 支持 | 有 | 有 |
| 自定义代码 | Apex + JavaScript | C# + YAML + Bot Framework |
| API 扩展 | MuleSoft API + REST | REST API + Custom Connectors |
| 低代码扩展 | Flows + Prompt Builder | Power Automate + Prompts |
| 特殊能力 | -- | Computer Use Tool |

---

## 10. 部署模式

### Salesforce Agentforce

- **SaaS（主模式）**: 基于 Hyperforce 的多租户云服务
- **Hyperforce**: Salesforce 的公有云基础设施，支持:
  - **全球数据驻留**: 美国(东1/东2/西2)、日本、韩国、印度(孟买/海得拉巴)、新加坡、澳大利亚、印尼、加拿大、德国、瑞士、瑞典、意大利、英国、法国、以色列、巴西、阿联酋 -- **19+ 区域**
  - 安全、合规、高性能基础设施
- **Government Cloud Plus**:
  - FedRAMP High 认证
  - DoD IL2/IL5 认证
  - CJIS 合规
  - IRS 1075 认证
- **GovSlack**: FedRAMP High, DoD IL2/IL4
- **私有化部署**: 不支持真正的 On-Premise，但通过 Hyperforce 可实现区域数据驻留和主权云

**合规认证概览**:
- SOC 1/2/3
- ISO 27001/27017/27018/27701/22301/42001/9001
- FedRAMP High & Moderate
- HIPAA
- PCI DSS 4.0.1
- HITRUST
- CSA STAR
- IRAP (澳大利亚)
- ISMAP (日本)
- C5 (德国)
- ENS High (西班牙)
- TISAX
- NEN 7510 (荷兰)
- HDS (法国)
- CMMC
- UK Cyber Essentials
- GDPR (EU/UK BCRs)
- DORA
- 等 30+ 项

### Microsoft Copilot Studio

- **SaaS（主模式）**: 基于 Azure 的云服务
- **Azure 基础设施**:
  - 全球 60+ Azure 区域
  - Geographic Data Residency 支持
  - 可配置禁止跨地理位置数据移动
- **Government Cloud**:
  - US GCC 计划支持（Power Platform GCC）
  - Azure Government 集成
- **混合部署**: 通过 Azure 和 Power Platform 的混合架构能力
- **私有化**: 不支持纯 On-Premise，但 Azure 提供 Azure Stack 等混合选项

**合规认证**: 继承 Azure 和 Microsoft 365 的完整合规体系（Azure 拥有 100+ 合规认证）

### 对比

| 能力 | Agentforce | Copilot Studio |
|------|-----------|----------------|
| 主要模式 | SaaS (Hyperforce) | SaaS (Azure) |
| 数据驻留区域 | 19+ 区域 | 60+ Azure 区域 |
| 政府云 | Gov Cloud Plus (FedRAMP High) | GCC (Power Platform) |
| 私有化 | 不支持 | 不支持纯 On-Prem |
| 混合部署 | 有限 | Azure Stack 等混合选项 |
| 合规认证 | 30+ 项（Salesforce 自有） | 100+（Azure 生态） |
| AI 专项认证 | ISO 42001:2023 | Microsoft Responsible AI |

---

## 11. 定价模型

### Salesforce Agentforce

**免费层**:
- Salesforce Foundations: $0 -- 含 Agent Builder、Prompt Builder、200K Flex Credits、250K Data Cloud Credits

**消费式定价 (Flex Credits)**:
- **$500 USD / 100K Credits**
- 每个标准 Action = 20 Flex Credits
- 每个 Voice Action = 30 Flex Credits
- Credits 可在 Actions、Prompts、Translations、Voice Actions 间通用
- 未用 Credits 不滚存
- 无超额罚金 -- 超出按合同费率月度后付

**对话定价 (Conversations)**:
- **$2 USD / conversation**
- 仅支持 Pre-purchase 模式
- 不能与 Flex Credits 在同一组织中混用

**购买模式**:
| 模式 | 说明 |
|------|------|
| Pre-purchase | 预付全额，最大折扣 |
| PayGo | 无预付，按用量月度后付 |
| PreCommit | 承诺基线无预付，月度后付，周期末结算 |

**按用户定价 (Employee-Facing)**:
| SKU | 价格 |
|-----|------|
| Agentforce Add-ons (Sales/Service/FS) | $125/user/month |
| Agentforce Industries Add-ons | $150/user/month |
| Agentforce 1 Editions | From $550/user/month |
| Agentforce User License | $5/user/month (需 Flex Credits) |

**成本示例**:
| 场景 | 月用量 | 月成本 |
|------|--------|--------|
| 案例管理 (100用户, 3案例/天) | 360K Credits | $1,800 |
| 现场服务调度 (10人, 3预约/天) | 72K Credits | $360 |
| 员工入职 (20新员工, 5问题) | 2K Credits | $10 |
| 语音预约管理 (300通话/月) | 36K Credits | $180 |

### Microsoft Copilot Studio

**Microsoft 365 Copilot 内含**:
- **$30/user/month** (年付)
- 含 Copilot Studio 访问权
- 内部工作流 Agent 无用量限制
- 需要 Microsoft 365 E3/E5/Business Standard/Business Premium 等资格计划

**Copilot Studio Pre-Purchase**:
- **$200/month per 25,000 Copilot Credits**
- 租户级别购买
- 预购可省约 20%
- 预付 Credits 用完后自动切换 Pay-as-you-go
- 需要 Azure 订阅

**Copilot Studio Pay-As-You-Go**:
- 按用量付费，无预付承诺
- 需要 Azure 订阅
- 免费 Azure 帐户含 $200 信用额度

**Teams 计划**:
- 部分 Microsoft 365 订阅含 Copilot Studio for Teams
- 仅限 Teams 渠道
- 功能受限（无 Generative Orchestration、无 Premium Connectors）

**免费试用**: 可注册试用，Agent 在试用过期后继续运行 90 天，但不能发布

### 定价对比

| 维度 | Agentforce | Copilot Studio |
|------|-----------|----------------|
| 免费层 | Salesforce Foundations (200K Credits) | M365 Copilot 内含 / 免费试用 |
| 入门门槛 | 需 Salesforce 订阅 | 需 M365 或 Azure 订阅 |
| 消费单价 | $500/100K Credits (~$0.10/action) | $200/25K Credits (~$0.008/credit) |
| 对话定价 | $2/conversation | 按 Credit 消耗 |
| 按用户 | $5-$550/user/month | $30/user/month (M365 Copilot) |
| 计费模式 | Pre-purchase / PayGo / PreCommit | Pre-purchase / Pay-as-you-go |
| 特点 | "Digital Labor" 消费定价 | 深度捆绑 M365 订阅 |

**关键洞察**: Agentforce 的定价更加灵活但复杂（多种 SKU），适合大型 Salesforce 客户。Copilot Studio 对已有 M365 Copilot 许可的客户几乎零边际成本。

---

## 12. AI 员工概念成熟度

### Salesforce Agentforce

**"Digital Labor" 概念产品化程度**: 高

- **品牌定位**: 明确提出 "limitless digital labour force"（无限数字劳动力）概念
- **营销叙事**: "Let humans do what they do best, and let Agentforce do the rest" -- 人机协作范式
- **预构建角色**:
  - **Service Agent**: 客服代表（24/7 自主处理问题）
  - **SDR (Sales Development Representative)**: 销售开发代表（主动联系潜客、处理异议、安排会议）
  - **Sales Coach**: 销售教练（个性化角色扮演训练）
  - **Merchandiser**: 商品管理员（站点设置、促销、产品描述）
  - **Buyer Agent**: 采购代理
  - **Personal Shopper**: 个人购物顾问
  - **Campaign Optimizer**: 营销活动优化师
- **行业覆盖**: 14+ 行业的 AI 员工角色
- **管理界面**: Agent Builder 提供统一的"员工管理"体验 -- 起草、测试、部署、监控
- **Observability**: Agent 可观测性工具，类似"员工绩效监控"
- **升级机制**: 复杂问题自动升级给人类员工，体现"团队协作"理念

**成熟度评估**: Salesforce 是行业中将 "AI Employee / Digital Labor" 概念产品化最彻底的平台。从品牌叙事、产品命名、定价模式（消费式，类似"工时"计费）到管理界面，全面贯彻了"数字员工"理念。

### Microsoft Copilot Studio

**"AI Agent" 概念产品化程度**: 中高

- **品牌定位**: "AI Agent" 而非 "AI Employee"，更偏向"工具/助手"叙事
- **概念体系**:
  - **Conversational Agents**: 对话型 Agent（回答问题、引导工作流）
  - **Autonomous Agents**: 自主型 Agent（自主管理任务/业务流程）
  - **Pre-built Agents**: 预构建 Agent
  - **Voice-Enabled Agents**: 语音 Agent
- **管理界面**:
  - Power Platform Admin Center -- IT 管理视角
  - Copilot Studio Web App -- 构建者视角
  - Microsoft 365 Admin Center -- 组织治理
- **Agent 治理**: 通过企业级治理框架管理 Agent 生命周期
- **ROI 追踪**: Viva Insights 追踪 Agent ROI
- **案例亮点**:
  - Pets at Home: 10x 欺诈检测速度
  - Virgin Money: 54% 客户参与度
  - Dow: 100+ Agent 用例，识别数百万美元成本节约

**成熟度评估**: Microsoft 更强调"Agent as Tool"而非"Agent as Employee"。虽然 Autonomous Agents 功能强大，但品牌叙事和管理范式更偏向 IT 工具管理而非人力资源管理。

### 对比

| 维度 | Agentforce | Copilot Studio |
|------|-----------|----------------|
| 品牌叙事 | "Digital Labor" / 数字员工 | "AI Agent" / AI 助手 |
| 角色化程度 | 高（SDR、Coach、Shopper 等） | 中（按功能分类） |
| 管理范式 | 类人力资源管理 | 类 IT 工具管理 |
| 定价隐喻 | 消费式（类工时计费） | 订阅+Credits（类 SaaS） |
| 自主性 | Atlas Engine 三阶段自主推理 | Autonomous Agents + Generative Orchestration |
| 24/7 运营 | 明确强调 24/7 可用 | 支持但不作为核心叙事 |
| "Employee" 产品化 | 行业最成熟 | 追赶中 |

---

## 综合对比矩阵

| 维度 | Salesforce Agentforce | Microsoft Copilot Studio | ClawForce 机会 |
|------|----------------------|--------------------------|----------------|
| 1. 架构模式 | Atlas Engine + Topics/Actions，CRM 原生 | Generative Orchestration + Power Platform | 可插拔引擎 + 平台无关 |
| 2. 多 Agent 协作 | 平台级 Multi-Agent Orchestration | Child/Connected Agents + 语义路由 | 统一的 Agent 团队管理 |
| 3. 工作流引擎 | Salesforce Flows + Agentforce Script | Power Automate + Agent Flows | 内置轻量流程引擎 + 外部集成 |
| 4. 权限/RBAC | Salesforce 成熟权限体系 + Trust Layer | Entra ID + Power Platform DLP | 独立的企业权限模型 |
| 5. 非技术UX | 中等（需 SF 背景） | 低门槛（低代码优先） | 面向管理者的极简 UX |
| 6. LLM 支持 | Atlas Engine 封装 | 多模型（GPT-5/Anthropic） | 开放多模型 + 自定义模型 |
| 7. 集成生态 | CRM 深度 + MuleSoft | 1400+ Connectors + M365 | 开放 API + 主流连接器 |
| 8. 知识库 | CRM 数据 + Data 360 | SharePoint + Graph | 统一知识管理层 |
| 9. 扩展性 | AgentExchange + Apex | Agent Store + 1400+ Connectors | 插件系统 + Marketplace |
| 10. 部署模式 | SaaS only (Hyperforce 19+ 区域) | SaaS (Azure 60+ 区域) | SaaS + 私有化 |
| 11. 定价 | 复杂多 SKU（$2/对话或 Credits） | M365 捆绑 + Credits | 简单透明定价 |
| 12. AI 员工成熟度 | 行业最成熟 ("Digital Labor") | 中高 ("AI Agent") | "AI 员工"为核心差异化 |

---

## ClawForce 战略建议

### 差异化定位

1. **"AI 员工管理平台" vs "AI 工具平台"**: Salesforce 已建立 "Digital Labor" 叙事，但深度绑定 CRM。ClawForce 的机会在于做一个**平台无关的 AI 员工管理平台**，面向所有企业管理者，而非特定 CRM/Office 用户。

2. **管理者视角 vs 开发者视角**: 两个竞品本质上仍是"开发者/IT 构建平台"。ClawForce 可以从**企业管理者视角**出发，提供类似 HR 系统的 Agent 管理体验（招聘/入职/绩效/调度）。

3. **部署灵活性**: 两个竞品都不支持真正的私有化部署。ClawForce 可以提供 **SaaS + 私有化 + 混合** 三种模式，满足数据主权敏感客户。

### 产品优先级建议

| 优先级 | 能力 | 理由 |
|--------|------|------|
| P0 | 极简管理者 UX | 两个竞品都偏技术，这是最大差异点 |
| P0 | AI 员工角色模板 | 借鉴 Agentforce 的预构建角色，扩展到更多行业 |
| P0 | 多模型支持 | 避免供应商锁定，支持国产模型 |
| P1 | 工作流引擎 | 轻量内置 + 外部集成（Zapier/n8n 等） |
| P1 | 企业权限模型 | 独立的多租户 RBAC，不依赖特定生态 |
| P1 | 知识库管理 | 统一的企业知识管理，支持多种数据源 |
| P2 | 多 Agent 协作 | Agent 团队管理，类似团队组织架构 |
| P2 | 插件/市场 | 开放生态建设 |
| P2 | 私有化部署 | 满足特定行业需求 |

### 定价策略建议

- 避免 Agentforce 的复杂多 SKU 模式
- 借鉴 Copilot Studio 的简单 Credits 体系
- 建议: **基础版（按 Agent 数计费）+ 用量附加（按交互计费）**
- 提供有竞争力的免费层，降低试用门槛

### 技术架构建议

```
ClawForce Architecture (建议)
  ├── 管理者 Dashboard (HR 式管理界面)
  ├── Agent Builder (低代码 + 自然语言构建)
  ├── Orchestration Engine (可插拔推理引擎)
  │   ├── OpenAI / GPT 适配器
  │   ├── Anthropic Claude 适配器
  │   ├── 国产模型适配器 (DeepSeek/通义/文心等)
  │   └── 自定义模型适配器
  ├── Workflow Engine (轻量内置 + 外部集成)
  ├── Knowledge Hub (统一知识管理)
  ├── Permission Engine (独立 RBAC)
  ├── Integration Layer (开放 API + 连接器)
  ├── Observability (Agent 绩效监控)
  └── Deployment Options (SaaS / 私有化 / 混合)
```

---

## 附录: 信息来源

| 来源 | URL |
|------|-----|
| Salesforce Agentforce 官方页面 | salesforce.com/agentforce/ |
| Salesforce Agentforce 定价 | salesforce.com/agentforce/pricing/ |
| Salesforce 合规门户 | compliance.salesforce.com |
| Microsoft Copilot Studio 官方页面 | microsoft.com/en-us/microsoft-copilot/microsoft-copilot-studio |
| Microsoft Copilot Studio 文档 | learn.microsoft.com/en-us/microsoft-copilot-studio/ |
| Copilot Studio 安全与治理 | learn.microsoft.com/en-us/microsoft-copilot-studio/security-and-governance |
| Copilot Studio Connectors | learn.microsoft.com/en-us/microsoft-copilot-studio/advanced-connectors |
| Copilot Studio Generative Orchestration | learn.microsoft.com/en-us/microsoft-copilot-studio/advanced-generative-actions |
| Copilot Studio Topics 文档 | learn.microsoft.com/en-us/microsoft-copilot-studio/authoring-create-edit-topics |
| Copilot Studio 许可 | learn.microsoft.com/en-us/microsoft-copilot-studio/requirements-licensing-subscriptions |
| Copilot Studio M365 扩展 | learn.microsoft.com/en-us/microsoft-copilot-studio/microsoft-copilot-extend-copilot-extensions |
