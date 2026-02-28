# Coze vs Dify 深度竞品分析

> 为构建企业级 AI 员工平台 ClawForce 提供的竞品调研报告
> 分析日期：2026-02-28
> 信息来源：官方文档、GitHub 仓库、API 文档、开源代码分析

---

## 目录

1. [架构模式](#1-架构模式)
2. [多 Agent 协作](#2-多-agent-协作)
3. [工作流/流程引擎](#3-工作流流程引擎)
4. [权限与 RBAC](#4-权限与-rbac)
5. [非技术用户 UX](#5-非技术用户-ux)
6. [LLM 模型支持](#6-llm-模型支持)
7. [渠道/集成生态](#7-渠道集成生态)
8. [记忆/知识库](#8-记忆知识库)
9. [扩展性/插件系统](#9-扩展性插件系统)
10. [部署模式](#10-部署模式)
11. [开源与定价](#11-开源与定价)
12. [国内生态就绪度](#12-国内生态就绪度)
13. [综合对比矩阵](#13-综合对比矩阵)
14. [对 ClawForce 的启示](#14-对-clawforce-的启示)

---

## 1. 架构模式

### Coze（扣子）

| 维度 | 详情 |
|------|------|
| **整体架构** | 微服务架构，遵循领域驱动设计（DDD）原则 |
| **后端技术栈** | Golang（Go >= 1.23.4）|
| **HTTP 框架** | Hertz（字节跳动 CloudWeGo 生态的高性能 Go HTTP 框架）|
| **Agent/工作流运行时** | Eino 框架（CloudWeGo 开源，提供 Agent 运行时引擎、模型抽象、知识库索引检索）|
| **前端技术栈** | React + TypeScript（80.4%），Semi Design UI + Arco Design（字节内部组件库）|
| **工作流画布引擎** | FlowGram（字节跳动开源的高质量工作流构建引擎）|
| **构建系统** | Rspack v1.1.8（Rust 实现的 webpack 替代品），Rush.js（monorepo 管理）|
| **接口定义** | Thrift IDL（字节跳动体系常用）|
| **后端分层** | api -> application -> domain -> infra -> crossdomain（严格 DDD 分层）|
| **CDN** | 双 CDN 容灾：sf-coze-web-cdn.coze.com + sf-cdn.coze.com |
| **Serverless** | VeFaaS（字节跳动 Serverless 平台，用于插件云函数）|
| **监控** | Slardar SDK v1.14.4（字节内部前端监控），含白屏检测和 SPA 加载监控 |

**架构亮点**：
- 完全基于字节跳动内部技术栈构建，与字节云基础设施深度耦合
- DDD 分层架构设计规范，含 `crossdomain` 层处理跨领域业务逻辑
- 开源版本（Coze Studio）在 2025 年 6 月开源，GitHub Star 约 20K
- 配套 Coze Loop（Go 实现）提供 Agent 全生命周期优化：开发、调试、评估、监控

### Dify

| 维度 | 详情 |
|------|------|
| **整体架构** | 模块化单体 + Worker 分离模式 |
| **后端技术栈** | Python（Flask + Gunicorn）|
| **异步任务** | Celery（含 worker + beat 调度器）|
| **前端技术栈** | Next.js（React）|
| **数据库** | PostgreSQL（默认）/ MySQL / OceanBase / SeekDB（可选）|
| **缓存/消息队列** | Redis 6（必选，同时作为 Celery Broker）|
| **向量存储** | 支持 15+ 向量数据库引擎（详见知识库章节）|
| **代码沙箱** | DifySandbox（独立容器，安全执行用户代码）|
| **SSRF 防护** | Squid 代理（独立网络隔离）|
| **反向代理** | Nginx（SSL/TLS 终止 + 路由）|
| **文件存储** | 本地 / S3 / Azure Blob / 阿里云 OSS / 华为 OBS / 火山引擎 TOS / 腾讯 COS |
| **插件系统** | Plugin Daemon（独立进程，v0.5.3）|

**架构亮点**：
- Python 生态，开发效率高，社区贡献门槛低
- Docker Compose 一键部署，服务编排约 35 个容器（含所有可选组件）
- 核心服务 5 个：api、worker、worker_beat、web、init_permissions
- 向量数据库支持最广泛（Weaviate/Qdrant/Milvus/PGVector/Chroma/ES/OpenSearch 等 15+）
- 131K GitHub Star，9,108 commits，社区活跃度极高

### 架构对比小结

| 对比项 | Coze | Dify |
|--------|------|------|
| 语言 | Go | Python |
| 架构模式 | 微服务 + DDD | 模块化单体 + Worker |
| 性能定位 | 高性能、高并发 | 开发效率优先 |
| 技术生态 | 字节 CloudWeGo 闭环 | Python 开源生态 |
| 部署复杂度 | 中等 | 低（Docker Compose 即可）|
| 开源时间 | 2025.06（较晚）| 2023.04（先发优势）|
| 社区规模 | ~20K Star | ~131K Star |

---

## 2. 多 Agent 协作

### Coze

**多 Bot 管理机制**：
- 平台级多 Bot/Agent 管理：每个 Space（工作空间）下可创建多个独立 Bot
- Bot 可配置独立的工作流、知识库、插件、记忆等资源
- 支持 Bot 级别的分析面板（analytics），追踪使用数据
- 灰度发布（publish-gray）和预发环境（publish-ppe），支持 Bot 的渐进式发布

**Agent 间协作**：
- 工作流层面：支持子工作流（Sub-Workflow）节点，一个工作流可调用另一个工作流
- Bot 组合：通过工作流编排实现多 Bot 间的任务分发和结果聚合
- Eino 框架提供底层 Agent 运行时引擎，支持多 Agent 调度
- 当前更侧重于"单 Bot 多能力"模式而非显式的多 Agent 协作协议

**Coze Loop 优化**：
- 提供 Agent 级别的全生命周期监控
- 支持评估（Evaluate）功能，对 Agent 行为进行系统化测试

### Dify

**Agent 节点机制**：
- 工作流中的 Agent Node 支持两种策略：Function Calling 和 ReAct（Reason + Act）
- 每个 Agent Node 独立配置：模型、工具集、策略、指令、迭代上限
- 支持 50+ 内置工具（Google Search、DALL-E、Stable Diffusion、WolframAlpha 等）

**多 Agent 实现方式**：
- 通过工作流编排多个 Agent Node 实现多 Agent 架构
- 每个 Node 可以有不同的模型、工具和策略
- Agent 间通过变量传递实现数据流转
- 并行执行支持：单节点最多 10 个并行分支，最多 3 层嵌套

**Agent Strategy 插件**：
- 支持自定义推理策略插件，扩展 Agent 行为模式
- 社区可贡献自定义策略到 Marketplace

**MCP 协议集成**：
- 支持消费外部 MCP 服务作为 Agent 工具
- 支持将 Dify 应用发布为 MCP Server（仅 HTTP 传输）
- 与 Claude Desktop、Cursor 等工具集成

### 多 Agent 对比

| 对比项 | Coze | Dify |
|--------|------|------|
| 多 Agent 模式 | 多 Bot + 子工作流 | 工作流内多 Agent Node |
| Agent 策略 | Eino 框架内置 | Function Calling / ReAct + 可扩展 |
| Agent 间通信 | 子工作流调用 + 变量传递 | 节点间变量传递 |
| 并行 Agent | 工作流并行分支 | 最多 10 并行分支 x 3 层嵌套 |
| MCP 协议 | 支持 MCP 插件 | 完整 MCP 消费 + 发布 |
| Agent 评估 | Coze Loop + Evaluate | LLMOps 日志 + 注释系统 |
| 自定义策略 | 通过 Eino 扩展 | Agent Strategy 插件 |

---

## 3. 工作流/流程引擎

### Coze 工作流

**可视化构建器（FlowGram 引擎）**：
- 拖拽式画布编辑器，基于字节跳动开源的 FlowGram 引擎
- 支持工作流模板（客服、视频生成、实时话题等）
- 工作流独立发布和版本管理
- 支持工作流导入导出和协作开发

**节点类型**（从 feature flags 提取）：

| 节点类别 | 具体节点 |
|----------|----------|
| **LLM 节点** | 支持视觉（Vision）、函数调用、思维链（CoT）、缓存 |
| **代码节点** | Python 执行环境（安全警告：公网部署需注意） |
| **条件节点** | If/Else 条件分支 |
| **循环节点** | 循环迭代处理 |
| **意图节点** | 意图识别和路由 |
| **数据库节点** | 数据库读写操作 |
| **HTTP 节点** | 外部 API 调用 |
| **音视频生成** | 音频/视频生成节点 |
| **图像生成** | 含 SeeDream 模型支持 |
| **子工作流** | 工作流嵌套调用 |
| **NL2DB** | 自然语言查询数据库 |
| **知识库节点** | RAG 检索 |
| **插件节点** | 调用平台插件 |

**流程控制**：
- 支持条件分支、循环、子工作流嵌套
- 工作流级别的 Job 管理系统（创建、编辑、任务级视图）
- 批量执行和定时任务

### Dify 工作流

**两种应用类型**：

| 类型 | 特点 |
|------|------|
| **Workflow** | 单轮任务处理，支持批量执行，可通过 User Input 或 Trigger（定时/Webhook/插件）启动 |
| **Chatflow** | 多轮对话模式，支持会话持久变量、LLM 跨轮记忆、流式文本/图片/文件输出 |

**完整节点列表**（21 种）：

| 节点类别 | 节点名称 | 功能 |
|----------|----------|------|
| **触发器** | User Input / Plugin Trigger / Schedule Trigger / Webhook Trigger | 工作流启动点 |
| **LLM** | LLM Node | 调用语言模型生成/分析 |
| **Agent** | Agent Node | 自主工具调用（Function Calling / ReAct）|
| **知识** | Knowledge Retrieval | RAG 知识检索 |
| **条件** | If-Else | 条件分支路由 |
| **循环** | Iteration / Loop | 数组迭代 / 渐进式循环 |
| **代码** | Code Node | Python / JavaScript 自定义处理 |
| **HTTP** | HTTP Request | 外部 API 调用 |
| **模板** | Template (Jinja2) | 数据格式化转换 |
| **文档** | Document Extractor | 上传文档文本提取 |
| **分类** | Question Classifier | 用户输入智能分类路由 |
| **参数** | Parameter Extractor | 自然语言转结构化数据 |
| **列表** | List Operator | 数组过滤、排序、选取 |
| **变量** | Variable Aggregator / Variable Assigner | 多分支变量合并 / 会话变量管理 |
| **人工** | Human Input | 工作流暂停等待人工输入 |
| **工具** | Tools Node | 预置/自定义工具调用 |
| **输出** | Answer (Chatflow) / Output (Workflow) | 响应内容定义 |

**执行模式**：
- 串行执行：节点顺序等待
- 并行执行：单节点最多 10 个并行分支，最多 3 层嵌套
- 变量访问规则：串行可访问所有前驱变量；并行分支只能访问分叉前的变量；汇合后可访问所有分支输出

**调试工具**：
- 单节点调试（Step Run）
- 变量检查器（Variable Inspector）
- 变量依赖可视化（Shift 键触发）
- 运行历史和日志
- 版本控制
- 错误类型分类和预定义错误处理逻辑

**DSL 导出**：
- Dify DSL（YAML 格式）支持应用配置的完整导出/导入
- 环境变量隔离敏感数据

### 工作流对比

| 对比项 | Coze | Dify |
|--------|------|------|
| 画布引擎 | FlowGram（自研开源）| 自研可视化画布 |
| 节点类型数 | 15+ | 21 种（已明确文档化）|
| 触发方式 | 手动 + Job 定时 | User Input / Schedule / Webhook / Plugin |
| 代码执行 | Python | Python + JavaScript |
| 应用类型 | 统一工作流 | Workflow（单轮）+ Chatflow（多轮）|
| 并行执行 | 支持 | 10 并行 x 3 层嵌套（有明确限制）|
| 子工作流 | 支持 | 通过工具节点调用其他 Workflow |
| 调试能力 | 工作流级运行 | 单节点 + 变量检查 + 历史日志 |
| DSL 导出 | 导入导出功能 | YAML DSL（完整导出/导入）|
| 版本管理 | 灰度/PPE 发布 | 版本控制 + 回滚 |
| 人工节点 | 未明确 | Human Input Node |
| 独特节点 | NL2DB、意图识别、音视频生成 | Question Classifier、Parameter Extractor |

---

## 4. 权限与 RBAC

### Coze

**企业级权限体系**（从路由和 feature flags 分析）：

| 层级 | 能力 |
|------|------|
| **企业（Enterprise）** | 多组织管理、SSO 单点登录、安全配置、加密管理 |
| **组织（Organization）** | 成员管理、工作空间管理、发布渠道管理 |
| **工作空间（Space）** | Bot/工作流/知识库/插件的资源隔离 |
| **团队（Team）** | 团队标签页管理（team tab）|

**安全特性**：
- Enterprise SSO 集成
- 设备管理（device management）
- 声纹认证（voiceprint）
- 私有网络配置（private network）
- 加密管理（encryption management）
- 发布连接器权限控制（publish connector permission）
- 模型访问控制（自定义模型、训练配置、使用量追踪）
- OAuth 2.0 完整流程（PAT + SAT + 设备激活）

**多租户**：
- 企业 -> 组织 -> 工作空间 三级多租户架构
- 工作空间级别的资源隔离
- 企业级商店（enterprise store）

### Dify

**5 种角色的 RBAC 模型**：

| 角色 | 权限范围 |
|------|----------|
| **Owner** | 完全控制，含账单和成员管理，每 workspace 唯一 |
| **Admin** | 成员管理、模型配置、应用管理、插件安装（不能改角色/管账单）|
| **Editor** | 应用开发：创建/编辑/删除应用和知识库 |
| **Member** | 仅使用已发布应用 |
| **Dataset Operator** | 知识库专员，专注数据集管理 |

**权限矩阵**：

| 能力 | Owner | Admin | Editor | Member | Dataset Operator |
|------|-------|-------|--------|--------|-----------------|
| 账单管理 | Yes | -- | -- | -- | -- |
| 成员增删 | Yes | Yes | -- | -- | -- |
| 角色变更 | Yes | -- | -- | -- | -- |
| 模型配置 | Yes | Yes | -- | -- | -- |
| 应用 CRUD | Yes | Yes | Yes | -- | -- |
| 知识库管理 | Yes | Yes | Yes | -- | Yes |
| 使用应用 | Yes | Yes | Yes | Yes | 有限 |
| 插件安装 | Yes | Yes | -- | -- | -- |

**多租户**：
- Workspace 级别隔离
- 用户可同时属于多个 Workspace
- 资源继承：Workspace 级模型/插件/知识库对有权限成员可见

**版本限制**：

| 版本 | 成员上限 |
|------|----------|
| Free | 1 |
| Professional | 3 |
| Team | 无限 |
| Community/Enterprise | 无限 |

### RBAC 对比

| 对比项 | Coze | Dify |
|--------|------|------|
| 角色数量 | 企业级多层角色（未完全公开）| 5 种明确角色 |
| 多租户层级 | 企业 -> 组织 -> 工作空间（3 层）| Workspace 单层 |
| SSO | 企业版支持 | 社区版需配置邮件服务 |
| 设备管理 | 支持 | 不支持 |
| 声纹认证 | 支持 | 不支持 |
| 安全审计 | 企业级安全配置 | 基础日志 |
| 适用场景 | 大型企业 | 中小团队/开发者 |

---

## 5. 非技术用户 UX

### Coze

**定位**："AI 办公助手一站式平台"，明确面向非技术用户

**可视化构建能力**：
- 拖拽式工作流画布（FlowGram）
- Bot 构建零代码：通过自然语言描述 + 可视化配置创建 Bot
- UI Builder：可视化界面构建器，支持自定义组件和预览
- 模板商店：客服、视频生成、实时话题等预置模板
- Bot Store：直接使用社区共享的 Bot

**典型非技术用户使用流程**：
1. 浏览 Bot Store / 模板，选择或创建 Bot
2. 自然语言描述 Bot 功能和行为
3. 可视化配置知识库（上传文档）
4. 添加插件（从插件商店选择）
5. 可视化拖拽工作流（如需复杂逻辑）
6. 一键发布到飞书/抖音/Web/API
7. 查看分析面板了解使用情况

**办公场景覆盖**：
- AI 写作、PPT 制作、表格处理、设计、播客、生图
- 直接面向最终用户的生产力工具

**上手难度**：低。有大量预置模板和 Bot 商店，非技术用户可在几分钟内创建可用的 Bot。

### Dify

**定位**："开源 LLM 应用开发平台"，主要面向开发者但兼顾低代码

**可视化构建能力**：
- Prompt IDE：直观的提示词编写和模型对比界面
- 可视化工作流画布：拖拽式节点编排
- 知识库管理 UI：上传文档、配置索引、测试检索
- 应用模板：30 分钟快速开始指南
- Web App 自动生成：发布后自动获得可用的 Web 应用

**目标用户画像**：
- 主要：开发者、技术产品经理
- 次要：有一定技术背景的业务人员
- 不太适合：完全无技术背景的最终用户

**上手难度**：中等。需要理解基本概念（Workflow/Chatflow、变量、节点），但可视化界面降低了编程门槛。

### UX 对比

| 对比项 | Coze | Dify |
|--------|------|------|
| 目标用户 | 所有人（含非技术用户）| 开发者为主 |
| 上手难度 | 低 | 中等 |
| Bot 商店 | 有（Agent + Plugin + Workflow）| 应用模板（较少）|
| UI Builder | 有（自定义组件 + 预览）| 无 |
| 预置模板 | 丰富（客服、视频、话题等）| 有限 |
| 办公场景 | 写作/PPT/表格/设计/播客/生图 | 不覆盖 |
| 即时可用性 | 高（SaaS 直接使用）| 需部署或使用云版 |

---

## 6. LLM 模型支持

### Coze

**模型支持**：
- 字节跳动自研模型（豆包系列）为核心
- OpenAI 系列（GPT-4 等）
- Volcengine（火山引擎）模型服务集成
- 开源版支持 OpenAI 兼容 API 格式的任意模型
- 模型管理功能：自定义模型部署、训练配置、使用量追踪（entity-usage）
- 企业版支持私有模型部署

**模型功能标签**（从 feature flags 提取）：
- Vision（视觉理解）
- Function Calling（函数调用）
- Chain of Thought（思维链）
- Cache（模型缓存）

### Dify

**模型支持范围**（官方声明"数百个模型"）：

| 类别 | 支持的提供商 |
|------|-------------|
| **商业 LLM** | OpenAI (GPT-4/3.5-turbo)、Anthropic (Claude 3)、Google (Gemini)、Cohere |
| **开源 LLM** | Llama 3、Mistral 等（通过 Ollama 本地运行）|
| **API 兼容** | 任何兼容 OpenAI API 格式的模型 |
| **Embedding** | OpenAI Embeddings、Cohere Embeddings、Azure OpenAI |
| **图像生成** | DALL-E、Stable Diffusion |
| **语音** | Whisper、ElevenLabs |
| **审核** | Moderation APIs |

**模型管理功能**：
- `POSITION_PROVIDER_PINS`：置顶特定模型提供商
- `POSITION_PROVIDER_INCLUDES`：限制可用模型范围
- `POSITION_PROVIDER_EXCLUDES`：隐藏特定提供商
- 多模态图片发送格式控制（base64/url）
- 通过 Model Provider Plugin 扩展任意模型

**国产模型支持**：
- Dify 通过插件机制广泛支持国产模型（通义千问、智谱、百川、DeepSeek、文心一言等）
- 支持火山引擎 TOS 作为存储后端
- 支持阿里云、腾讯云、华为云存储

### 模型对比

| 对比项 | Coze | Dify |
|--------|------|------|
| 默认模型 | 豆包（字节自研）| OpenAI（需自行配置 Key）|
| 模型广度 | 中等（以字节生态为主）| 广泛（数百个模型）|
| 本地模型 | 通过 OpenAI 兼容 API | Ollama 原生支持 |
| 模型插件 | 有（model management）| Model Provider Plugin |
| 多模态 | Vision 支持 | Vision + 多模态 Embedding |
| 模型缓存 | 支持（cache flag）| 依赖模型提供商 |

---

## 7. 渠道/集成生态

### Coze

**字节生态深度集成**：

| 渠道 | 集成深度 |
|------|----------|
| **飞书** | Wiki 搜索集成、知识库同步 |
| **抖音** | 抖音机器人发布（douyin_bot）|
| **微信** | 微信授权转移（wechat-auth-transfer）|
| **Web** | Chat Link（分享链接）、Chat SDK（嵌入式）、Web App |
| **API** | OpenAPI + OAuth 2.0（PAT/SAT）+ Playground |
| **MCP** | MCP 插件支持 |

**企业集成**：
- 企业级连接器权限管理（Connector Permission）
- 组织级发布渠道配置
- OAuth 完整流程（Consent/Install/Device Activation）
- Callback 机制（Connector Callback + Normal Callback）

**发布策略**：
- 灰度发布（Gray Release）
- 预发环境（PPE）
- 版本化发布

### Dify

**集成方式**：

| 集成类型 | 详情 |
|----------|------|
| **RESTful API** | Completion Messages + Chat Messages 端点 |
| **Web App** | 自动生成可嵌入的 Web 应用（Chat/Workflow 两种形态）|
| **MCP Server** | 将应用发布为 MCP 服务器（Claude Desktop、Cursor 集成）|
| **MCP Client** | 消费外部 MCP 工具（仅 HTTP 传输）|
| **Webhook** | Webhook Trigger 触发工作流 |
| **嵌入网站** | JavaScript 嵌入代码 |
| **Slack** | Slack Bot Plugin 开发指南 |

**可观测性集成**：
- Langfuse、LangSmith、Arize、Opik、Phoenix、W&B Weave
- 阿里云监控
- Grafana Dashboard（PostgreSQL 数据源）

**SDK**：
- 官方无独立 SDK，通过 RESTful API + Bearer Token 调用
- 社区 SDK 可能存在

### 渠道对比

| 对比项 | Coze | Dify |
|--------|------|------|
| IM 渠道 | 飞书、抖音、微信 | Slack（通过插件）|
| Web 嵌入 | Chat SDK + Web App | 嵌入代码 + Web App |
| API | OpenAPI + OAuth 2.0 | RESTful + Bearer Token |
| MCP | 插件消费 | 双向（消费 + 发布）|
| Webhook | Callback 机制 | Webhook Trigger |
| 可观测性 | Coze Loop | Langfuse/LangSmith 等 6+ 集成 |
| 发布策略 | 灰度/PPE | 版本控制 |
| 国内 IM | 飞书 + 抖音 + 微信 | 无原生支持 |

---

## 8. 记忆/知识库

### Coze

**知识库**：
- 支持多种格式：图片、Markdown、Excel 等
- 飞书 Wiki 搜索集成
- 底层使用火山引擎 VikingDB（向量数据库）
- 知识库支持数据集 + 文档两级管理
- 文档上传和索引

**记忆系统**：
- 长期记忆（LTM - Long Term Memory）
- 基于用户历史对话生成更精准的回复
- 独立 Memory 模块（`/memory/{memory_id}`）
- 数据库模块（`/database/{table_id}`）支持结构化数据存储

**NL2DB**：
- 自然语言查询数据库功能（从 feature flags 确认）
- 工作流中的数据库节点支持

### Dify

**RAG Pipeline 详解**：

**索引方式**：

| 方式 | 特点 |
|------|------|
| **高质量索引** | Embedding 向量化，支持向量/全文/混合三种检索策略，不可回退 |
| **经济索引** | 每 Chunk 提取 10 个关键词，零 Token 消耗，仅倒排索引 |

**分块策略**：
- 标准分块：内容切分为结构化 Chunk
- Q&A 模式（自托管版）：自动生成问答对，Q-to-Q 匹配策略

**检索模式**（高质量索引）：

| 检索模式 | 机制 |
|----------|------|
| **向量搜索** | 查询向量化 -> 余弦相似度匹配 |
| **全文搜索** | 倒排索引关键词匹配 |
| **混合搜索** | 向量 + 全文同时执行 -> 重排序合并 |

**混合搜索配置**：
- 权重设置：语义权重 vs 关键词权重可自由调节
- Rerank 模型：第三方重排序模型（支持多模态 Rerank）

**检索参数**：
- TopK：默认 3，根据模型上下文窗口自动调整
- Score Threshold：默认 0.5，最低相似度阈值
- 多模态 Embedding：支持 Vision 图片嵌入和跨模态检索

**Knowledge Pipeline（新特性）**：
- 可视化数据处理管道：Data Sources -> Data Extraction -> Data Processing -> Knowledge Storage
- 支持内置模板、空白画布、导入配置
- 节点化处理流程，类似 ETL

**向量数据库支持（15+）**：
- Weaviate（默认）、Qdrant、Milvus、PGVector、PGVecto-rs
- Chroma、MyScale、OceanBase、SeekDB
- OpenSearch、Elasticsearch
- OpenGauss、VastBase、IRIS、MatrixOne

**数据源集成**：
- 本地文件上传
- Notion 同步
- 网站导入
- 外部知识库 API 对接

### 知识库对比

| 对比项 | Coze | Dify |
|--------|------|------|
| RAG 架构 | VikingDB + Eino | 可插拔向量库（15+ 选项）|
| 索引方式 | 高质量索引 | 高质量 + 经济（双模式）|
| 检索策略 | 向量检索 | 向量 / 全文 / 混合 + Rerank |
| 分块策略 | 标准分块 | 标准 + Q&A 模式 |
| Knowledge Pipeline | 无明确文档 | 可视化 ETL Pipeline（新特性）|
| 多模态 | 支持图片 | 多模态 Embedding + Rerank |
| 长期记忆 | LTM（独立模块）| 会话变量（Chatflow）|
| 结构化数据 | Database 模块 + NL2DB | 无原生支持 |
| 外部知识 | 飞书 Wiki | Notion / 网站 / 外部 API |
| 文档管理 | 数据集 + 文档两级 | 知识库 -> 文档 -> Chunk 三级 + 子 Chunk |

---

## 9. 扩展性/插件系统

### Coze

**插件生态**：
- 官方插件商店（Store）：Agent、Plugin、Workflow 三类
- 云函数插件：基于 VeFaaS（字节 Serverless 平台）
- 云工具（Cloud Tool）：云端执行的工具插件
- 插件 Mock 测试：支持 Mock Set 配置

**开发者平台**：
- OpenAPI 完整体系
- OAuth 2.0（PAT + SAT）
- API Playground 在线调试
- SDK：Python、JavaScript、Java、Go（均 MIT 协议）
- Coze Loop SDK：Go、Java（Agent 优化工具链）

**扩展方式**：
1. 使用插件商店预置插件
2. 通过 VeFaaS 开发自定义云函数插件
3. 通过 OpenAPI 集成外部系统
4. 通过 OAuth 2.0 实现第三方授权
5. 使用 Chat SDK 嵌入到外部应用

### Dify

**4 种插件类型**：

| 插件类型 | 用途 |
|----------|------|
| **Models** | 接入自定义/第三方 AI 模型 |
| **Tools** | 为 Agent 和工作流构建专用能力 |
| **Agent Strategies** | 自定义 Agent 推理策略 |
| **Extensions** | 通过 HTTP Webhook 集成外部服务 |

**插件开发能力**：
- Dify Plugin CLI（命令行开发工具）
- 远程调试支持
- 持久化存储（KV Store）
- 插件日志系统
- 多语言 README
- Bundle 打包
- 反向调用：插件可反向调用 Dify 的 App、Model、Node、Tool

**插件发布**：
- Dify Marketplace（官方市场）
- GitHub 仓库发布
- 本地文件打包
- PR 自动发布机制

**开发者文档完善度**：
- 完整的 Cheatsheet
- 多种插件教程（Slack Bot、Flomo、Markdown Exporter 等）
- 通用规范 + 模型设计规则 + 工具返回规范
- 隐私保护指南 + 第三方签名验证

### 扩展性对比

| 对比项 | Coze | Dify |
|--------|------|------|
| 插件类型 | 工具插件 + 云函数 | 4 种类型（Models/Tools/Strategies/Extensions）|
| 插件市场 | 有（Plugin Store）| 有（Marketplace）|
| 开发工具 | SDK（4 语言）| CLI + 远程调试 + KV Store |
| 反向调用 | 通过 API | 插件可反向调用 Dify 内部能力 |
| Serverless | VeFaaS | DifySandbox（代码执行）|
| 发布方式 | 平台提交 | Marketplace / GitHub / 文件 / PR 自动化 |
| 自定义模型 | 模型管理 + 训练配置 | Model Provider Plugin |
| API 文档 | OpenAPI + Playground | 自动生成应用级 API 文档 |

---

## 10. 部署模式

### Coze

| 部署方式 | 详情 |
|----------|------|
| **SaaS（国际版）** | coze.com，亚太区域部署（Asia-SouthEastBD）|
| **SaaS（国内版）** | coze.cn（扣子），华北区域（cn, China-North）|
| **私有化（开源版）** | Coze Studio，Docker Compose + Kubernetes Helm |
| **最低配置** | 2 CPU、4 GB RAM |

**部署方式**：
```
# Docker Compose
git clone https://github.com/coze-dev/coze-studio.git
cd coze-studio && make web

# Kubernetes
helm/charts/opencoze/
```

**安全注意事项**（公网部署）：
- 账号注册暴露风险
- Python 代码执行环境安全
- SSRF 漏洞
- 部分 API 水平越权风险

### Dify

| 部署方式 | 详情 |
|----------|------|
| **SaaS** | dify.ai/cloud，200 次免费 GPT-4 调用 |
| **Docker Compose** | 一键部署（最简方式），2 CPU + 4 GB RAM |
| **Kubernetes** | 多种社区 Helm Charts（v1.6.0+）|
| **Terraform** | Azure Global + Google Cloud |
| **AWS** | CDK (EKS/ECS) + Marketplace AMI |
| **阿里云** | 计算巢 + 数据管理一键部署 |
| **Azure DevOps** | AKS + Helm Chart Pipeline |
| **本地源码** | 前后端分离部署 |

**Docker Compose 部署**：
```bash
cd dify/docker
cp .env.example .env
docker compose up -d
# 访问 http://localhost/install
```

**环境变量管理**：
- 完整的 `.env` 配置体系
- 支持热配置：数据库自动迁移（MIGRATION_ENABLED）
- Worker 数量公式：CPU 核数 x 2 + 1
- Gunicorn 超时：默认 200s，SSE 推荐 360s

### 部署对比

| 对比项 | Coze | Dify |
|--------|------|------|
| SaaS | 国际版 + 国内版 | dify.ai/cloud |
| Docker | Coze Studio 开源版 | 官方支持 |
| Kubernetes | Helm Charts | 多种社区方案 |
| Terraform | 无 | Azure + GCP |
| AWS | 无 | CDK + Marketplace |
| 阿里云 | 无（但底层可用火山引擎）| 计算巢一键部署 |
| 最低配置 | 2C4G | 2C4G |
| 部署成熟度 | 较新（2025.06 开源）| 成熟（2023.04 开源）|

---

## 11. 开源与定价

### Coze

**开源**：
- Coze Studio：Apache 2.0 协议
- Coze Loop：Apache 2.0 协议
- SDK（Python/JS/Java/Go）：MIT 协议
- 开源时间：2025 年 6 月
- GitHub Star：~20K（Studio）+ ~5.3K（Loop）

**定价**（SaaS 版）：
- 免费版：基础功能可用
- Premium 版：存在付费层（`/premium/page` 路由）
- 企业版：企业级功能（SSO、安全配置、私有网络等）
- 购买历史追踪（`/template/purchase-history`）
- 创作者收入系统（`/template/income`）
- 具体价格未在公开文档中找到

### Dify

**开源**：
- 协议：基于 Apache 2.0 的 Dify Open Source License（有附加条件）
- 开源时间：2023 年 4 月
- GitHub Star：~131K，Forks：~20.3K
- 教育计划：持 .edu 邮箱免费使用 Professional 版

**定价**：

| 版本 | 成员 | 应用数 | API 调用 | 支持 |
|------|------|--------|----------|------|
| **Free** | 1 | 5 | 5,000/天 | 社区 |
| **Professional** | 3 | 50 | 无限 | 优先邮件 |
| **Team** | 50 | 200 | 无限 | 优先邮件 + Slack |
| **Enterprise** | 自定义 | 自定义 | 自定义 | 定制（联系 business@dify.ai）|

**自托管**：
- Community Edition：免费，功能完整
- Enterprise Edition：额外企业功能，需联系商务

### 开源与定价对比

| 对比项 | Coze | Dify |
|--------|------|------|
| 开源协议 | Apache 2.0 / MIT | 基于 Apache 2.0（有附加条件）|
| 核心功能开源 | 是（Studio + Loop）| 是（完整功能）|
| 社区规模 | ~25K Star（合计）| ~131K Star |
| SaaS 免费层 | 有 | 有（5 应用 / 5000 调用/天）|
| 企业版 | 有（价格未公开）| 有（联系商务）|
| 自托管免费 | 是 | 是 |
| 教育优惠 | 未知 | .edu 邮箱免费 Pro |
| 创作者经济 | 有（收入系统）| 无 |

---

## 12. 国内生态就绪度

### Coze（扣子）

| 维度 | 就绪度 | 详情 |
|------|--------|------|
| **中文支持** | ★★★★★ | 原生中文产品，国内版独立部署 |
| **国内域名** | ★★★★★ | coze.cn 独立域名 + CDN |
| **国产模型** | ★★★★★ | 豆包系列为默认模型，火山引擎生态 |
| **国内 IM** | ★★★★★ | 飞书深度集成 + 抖音机器人 + 微信授权 |
| **国内云** | ★★★★☆ | 火山引擎基础设施（VikingDB、VeFaaS、TOS）|
| **合规性** | ★★★★★ | 国内独立部署，数据不出境 |
| **企业就绪** | ★★★★★ | 企业级 SSO/安全/加密管理 |
| **支付** | ★★★★★ | 国内支付体系 |

**核心优势**：
- 字节跳动全生态加持：飞书（办公）+ 抖音（流量）+ 火山引擎（基础设施）
- 国内版独立运营，合规无忧
- 豆包模型持续迭代，性价比高
- 非技术用户友好度极高

### Dify

| 维度 | 就绪度 | 详情 |
|------|--------|------|
| **中文支持** | ★★★★☆ | 界面支持中文，文档以英文为主 |
| **国内域名** | ★★★☆☆ | 无独立国内域名，需自行部署 |
| **国产模型** | ★★★★☆ | 通过插件支持通义/智谱/百川/DeepSeek 等 |
| **国内 IM** | ★★☆☆☆ | 无飞书/钉钉/微信原生集成 |
| **国内云** | ★★★★☆ | 阿里云计算巢 + OSS/OBS/TOS/COS 存储 |
| **合规性** | ★★★★☆ | 自托管可保证数据不出境 |
| **企业就绪** | ★★★☆☆ | 基础 RBAC，企业版需联系商务 |
| **向量数据库** | ★★★★★ | 支持 OceanBase、OpenGauss、MatrixOne 等国产向量库 |

**核心优势**：
- 开源社区庞大，国内开发者活跃
- 自托管灵活度高，可深度定制
- 向量数据库选择最广泛（含多个国产选项）
- 阿里云一键部署降低门槛

---

## 13. 综合对比矩阵

| 维度 | Coze | Dify | 对 ClawForce 的参考价值 |
|------|------|------|------------------------|
| **架构** | Go 微服务 + DDD | Python 模块化单体 | Go 微服务更适合高并发企业场景 |
| **多 Agent** | 多 Bot + 子工作流 | 工作流多 Agent Node | 两者均可参考，需设计显式协作协议 |
| **工作流** | FlowGram + 15+ 节点 | 21 节点 + Chatflow/Workflow 双模式 | Dify 节点体系更完善，Coze 的 NL2DB 值得借鉴 |
| **RBAC** | 企业级三层架构 | 5 角色 Workspace 模型 | Coze 的企业级权限体系更适合大企业 |
| **UX** | 非技术用户友好 | 开发者导向 | ClawForce 需兼顾两类用户 |
| **模型** | 字节生态为主 | 广泛支持 | Dify 的可插拔模型架构更灵活 |
| **渠道** | 飞书/抖音/微信 | API/MCP/Web | 国内场景 Coze 优势明显 |
| **知识库** | VikingDB + LTM | 15+ 向量库 + Pipeline | Dify RAG 架构更成熟完善 |
| **插件** | VeFaaS 云函数 | 4 类型 + CLI + 反向调用 | Dify 插件生态更开放 |
| **部署** | SaaS + Docker/K8s | SaaS + Docker/K8s/Terraform/AWS/阿里云 | Dify 部署选项更丰富 |
| **开源** | Apache 2.0（较新）| 基于 Apache 2.0 | 两者均可自托管 |
| **国内生态** | ★★★★★ | ★★★★☆ | Coze 国内生态完胜 |

---

## 14. 对 ClawForce 的启示

### 从 Coze 学习

1. **非技术用户体验设计**
   - Bot Store + 模板商店 + UI Builder 的组合极大降低了使用门槛
   - "AI 办公助手"的定位比"开发平台"更容易被业务用户接受
   - 建议 ClawForce 提供预置 AI 员工模板库

2. **国内 IM 集成是必选项**
   - 飞书/抖音/微信集成是 Coze 在国内市场的核心壁垒
   - ClawForce 必须优先支持飞书/钉钉/企业微信

3. **灰度发布机制**
   - Gray Release + PPE 环境设计值得借鉴
   - 企业级 AI 员工需要稳健的发布策略

4. **DDD 架构参考**
   - Go + DDD 分层 + CloudWeGo 是经过大规模验证的企业级架构
   - crossdomain 层的设计思路对处理多 Agent 跨领域交互有参考价值

5. **NL2DB 能力**
   - 自然语言查询数据库在企业场景中需求强烈
   - 建议 ClawForce 内置此能力

### 从 Dify 学习

1. **RAG Pipeline 架构**
   - 高质量索引 + 经济索引双模式设计务实
   - 混合搜索 + Rerank 重排序是 RAG 质量的关键
   - Knowledge Pipeline 可视化 ETL 概念先进
   - 建议 ClawForce 参考 Dify 的三级（向量/全文/混合）检索架构

2. **工作流节点体系**
   - Chatflow vs Workflow 双模式清晰定义了单轮和多轮场景
   - Human Input Node 支持人工介入（HITL）
   - Variable Aggregator 解决了并行分支变量合并问题
   - 建议 ClawForce 设计类似的完整节点类型体系

3. **插件架构的开放性**
   - 4 种插件类型覆盖全面（Models/Tools/Strategies/Extensions）
   - 反向调用机制允许插件调用平台内部能力
   - CLI + 远程调试提升了开发者体验
   - 建议 ClawForce 参考此插件分类体系

4. **可观测性集成**
   - Langfuse/LangSmith 等 6+ 可观测性平台集成
   - 日志 + 注释 + Dashboard 完整 LLMOps 体系
   - 建议 ClawForce 内置 LLMOps 能力

5. **DSL 导出格式**
   - YAML DSL 实现应用的完整可移植性
   - 环境变量隔离敏感信息的设计值得借鉴

### ClawForce 差异化方向建议

1. **多 Agent 协作协议**：两个竞品在多 Agent 协作层面都不够深入，Coze 是多 Bot 管理，Dify 是工作流内多节点。ClawForce 可以设计显式的 Agent-to-Agent 通信协议（如基于 A2A 标准），实现真正的多 Agent 协作编排

2. **AI 员工人设系统**：两者都缺乏"AI 员工"维度的人设、技能、权限一体化管理。ClawForce 可以在 Agent 之上构建"员工"抽象层

3. **企业级审计与合规**：Coze 有企业安全基础但不够透明，Dify 侧重开发者。ClawForce 可以在企业审计、操作日志、合规报告方面做深

4. **知识库 + 记忆的统一架构**：Coze 有 LTM + Database，Dify 有 RAG Pipeline。ClawForce 可以设计统一的知识-记忆-结构化数据三合一架构

5. **工作流 + 多 Agent 混合编排**：超越单纯的工作流节点或多 Bot 管理，设计工作流中可嵌入 Agent 协作单元，Agent 协作中可触发工作流的双向编排模式

---

## 附录：数据来源

| 来源 | URL | 获取方式 |
|------|-----|----------|
| Coze 国际版前端 | coze.com | WebFetch + 路由/Feature Flags 分析 |
| Coze 国内版前端 | coze.cn | WebFetch + Feature Flags 分析 |
| Coze Studio GitHub | github.com/coze-dev/coze-studio | WebFetch |
| Coze 开源组织 | github.com/coze-dev | WebFetch |
| Dify GitHub | github.com/langgenius/dify | WebFetch |
| Dify 文档索引 | docs.dify.ai/llms.txt | WebFetch |
| Dify 工作流节点文档 | docs.dify.ai/en/use-dify/nodes/* | WebFetch |
| Dify RAG 文档 | docs.dify.ai/en/use-dify/knowledge/* | WebFetch |
| Dify 插件文档 | docs.dify.ai/en/develop-plugin/* | WebFetch |
| Dify Docker Compose | github.com docker-compose.yaml | WebFetch |
| Dify 环境变量文档 | docs.dify.ai/en/self-host/configuration/environments.md | WebFetch |
| Dify 定价文档 | docs.dify.ai/en/use-dify/workspace/subscription-management.md | WebFetch |

> 注意：部分信息（特别是 Coze 定价和企业版功能细节）未在公开渠道完全披露，分析基于可获取的代码结构、路由清单和 Feature Flags 推断。Dify 的信息基于官方开源文档，可靠度更高。
