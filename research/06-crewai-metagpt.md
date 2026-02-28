# CrewAI vs MetaGPT 深度竞品分析报告

> **目标**: 为 ClawForce AI 员工平台（首个场景: AI Dev Team PM + Developer + QA）提供竞品技术调研
> **调研日期**: 2026-02-28
> **数据来源**: 官方文档、GitHub 仓库、PyPI、产品官网

---

## 执行摘要

| 维度 | CrewAI | MetaGPT |
|------|--------|---------|
| **定位** | 通用多 Agent 编排框架 | 软件团队模拟框架（SOP 驱动） |
| **最新版本** | v1.9.3 (2026-01-30) | v0.8.2 (2025-03-09) |
| **GitHub Stars** | 44.8k | 64.6k |
| **License** | MIT | MIT |
| **Python 版本** | >=3.10, <3.14 | >=3.9, <3.12 |
| **核心理念** | Agent + Task + Crew + Process | Code = SOP(Team) |
| **商业产品** | CrewAI AMP Suite | Atoms (原 MGX) |
| **与 ClawForce 契合度** | 中 - 通用但需自建 SOP | 高 - 原生软件团队模拟 |

---

## 1. 架构模式

### CrewAI

**架构类型**: 轻量级 Python 框架（单体库 + 可选云平台）

**技术栈**:
- 纯 Python，完全独立于 LangChain（从 scratch 构建）
- 包管理: UV
- 配置: YAML + Python 装饰器（`@CrewBase`, `@agent`, `@task`, `@crew`）
- 存储: LanceDB（Memory）、ChromaDB/Qdrant（Knowledge）
- 嵌入: 支持 13 种嵌入提供商

**四大核心概念**:

| 概念 | 定义 | 关键属性 |
|------|------|----------|
| **Agent** | 自主执行单元，可执行任务、使用工具、委派工作 | `role`, `goal`, `backstory`, `llm`, `tools`, `allow_delegation`, `memory`, `reasoning` |
| **Task** | 具体执行任务，包含描述和期望输出 | `description`, `expected_output`, `agent`, `context`, `tools`, `guardrails`, `async_execution` |
| **Crew** | Agent 协作团队，定义执行策略 | `agents`, `tasks`, `process`, `memory`, `planning`, `knowledge_sources`, `stream` |
| **Process** | 任务执行流程控制 | `sequential`(线性), `hierarchical`(管理者委派), `consensual`(计划中) |

**Agent 定义示例**:
```yaml
# agents.yaml
researcher:
  role: "{topic} Senior Data Researcher"
  goal: "Uncover cutting-edge developments in {topic}"
  backstory: "You're a seasoned researcher with a knack for uncovering..."
```

```python
@CrewBase
class ResearchCrew():
    @agent
    def researcher(self) -> Agent:
        return Agent(
            config=self.agents_config['researcher'],
            tools=[SerperDevTool()],
            llm="openai/gpt-4o",
            allow_delegation=True,
            reasoning=True,  # 启用反思式推理
            max_iter=20,
        )
```

**Flow 系统**（v1.x 新增）:
- 事件驱动的工作流编排层，位于 Crew 之上
- 装饰器: `@start()`, `@listen()`, `@router()`, `@persist`, `@human_feedback`
- 状态管理: 非结构化（dict）或结构化（Pydantic BaseModel）
- 支持条件路由: `or_()`, `and_()` 组合
- 持久化: SQLite（默认），可自定义 FlowPersistence
- 可视化: `flow.plot()` 生成交互式 HTML 流程图

### MetaGPT

**架构类型**: 面向软件工程的多 Agent 框架（SOP 驱动）

**技术栈**:
- Python，依赖 Node.js + pnpm（完整功能）
- 配置: YAML（`config2.yaml`）
- 内置 Git 项目管理
- Jupyter Notebook 环境（Data Interpreter）

**三大核心概念**:

| 概念 | 定义 | 关键机制 |
|------|------|----------|
| **Role** | Agent 的逻辑抽象，绑定 Actions、Memory、思考策略 | `name`, `profile`, `goal`, `constraints`, `set_actions()`, `_watch()` |
| **Action** | Role 可执行的离散任务，可 LLM 驱动或独立运行 | `PROMPT_TEMPLATE`, `_aask()`, `run()` |
| **Message** | Agent 间通信载体 | `content`, `role`, `cause_by`（触发 Action 类型） |

**辅助概念**:

| 概念 | 作用 |
|------|------|
| **Environment** | Agent 共存的共享空间，消息发布/订阅的中介 |
| **Team** | 管理 Role 的注册、预算、项目执行 |
| **Memory** | 每步交互中的信息存储与检索 |
| **SOP** | 标准操作流程，控制 Role 间的协作顺序 |

**SOP 管道示例**:
```
UserRequirement → ProductManager(WritePRD) → Architect(WriteDesign)
→ ProjectManager(WriteTasks) → Engineer(WriteCode) → QaEngineer(WriteTest → RunCode → DebugError)
```

### 架构对比总结

| 对比项 | CrewAI | MetaGPT |
|--------|--------|---------|
| 架构哲学 | 灵活的 Agent 编排框架 | 软件公司 SOP 模拟 |
| 核心抽象 | Agent/Task/Crew/Process/Flow | Role/Action/Message/Environment |
| 执行模型 | 声明式（YAML+装饰器） | 命令式（类继承+消息订阅） |
| 通信模式 | 委派工具 + 任务上下文链 | 发布/订阅 + 消息路由 |
| 流程控制 | Process 枚举 + Flow 事件 | SOP 管道 + `_watch` 订阅 |
| 扩展难度 | 低（声明式配置） | 中（需理解消息路由） |

---

## 2. 多 Agent 协作

### CrewAI

**角色化 Agent 定义**:
- 通过 `role`（职能）、`goal`（目标）、`backstory`（背景故事）三要素定义人格化 Agent
- 支持 YAML 配置（推荐）或 Python 代码直接定义
- 运行时变量插值: `{topic}` 在 `kickoff(inputs={...})` 时替换

**协作协议**:

1. **委派工具（Delegation）**:
   - `allow_delegation=True` 自动为 Agent 注入两个内置工具:
     - `Delegate work to coworker(task, context, coworker)` — 委派子任务
     - `Ask question to coworker(question, context, coworker)` — 向同事提问
   - Manager 角色通常启用委派，专家角色禁用（防止循环委派）

2. **任务上下文链（Context）**:
   - `Task.context=[other_task]` 显式指定数据依赖
   - Sequential 模式下输出自动传递给下一个 Task
   - 支持异步任务 + context 等待

3. **Hierarchical 管理者模式**:
   - Manager Agent 自动创建或自定义
   - 动态分配任务给最合适的 Agent
   - 审核输出并决定是否通过

**协作模式**:

| 模式 | 描述 | 适用场景 |
|------|------|----------|
| 链式专业化 | Agent A → Agent B → Agent C 线性流 | 研究 → 写作 → 编辑 |
| 协作式单任务 | 主 Agent 运行时委派子任务给同事 | 复杂分析需多方输入 |
| 管理者层级 | PM Agent 协调专家团队 | 项目管理、团队协作 |

### MetaGPT

**角色化 Agent 定义**:
- 继承 `Role` 类，设置 `name`, `profile`, `goal`, `constraints`
- 通过 `set_actions([...])` 装备能力
- 通过 `_watch([...])` 订阅上游 Action 类型
- 预置角色: ProductManager("Alice"), Architect("Bob"), Engineer("Alex"), QaEngineer("Edward")

**协作协议 — 发布/订阅消息机制**:

1. **观察（_observe）**: Role 从 Environment 扫描匹配 `_watch` 列表的 Message
2. **思考（_think）**: 选择执行哪个 Action（设为 `self.rc.todo`）
3. **行动（_act）**: 执行 Action，产出 Message，`publish_message` 回 Environment

```python
class SimpleCoder(Role):
    def __init__(self):
        self.set_actions([SimpleWriteCode])
        self._watch([UserRequirement])  # 订阅用户需求

class SimpleTester(Role):
    def __init__(self):
        self.set_actions([SimpleWriteTest])
        self._watch([SimpleWriteCode])  # 订阅代码输出
```

**消息路由**:
- `cause_by` 字段标识消息来源 Action 类型
- `_watch` 基于 `cause_by` 过滤消息
- 支持 `MESSAGE_ROUTE_TO_SELF`（内部循环）和 `MESSAGE_ROUTE_TO_NONE`（终止）
- Engineer 完成后发消息给 QaEngineer("Edward")，QaEngineer 测试失败后可回环

**反应模式**:

| 模式 | 行为 |
|------|------|
| `BY_ORDER` | 按注册顺序执行 Actions |
| 灵活模式 | 由 `_think` 决定执行哪个 Action |
| Fixed SOP | 确定性管道，禁用 Memory |

### 协作对比总结

| 对比项 | CrewAI | MetaGPT |
|--------|--------|---------|
| 通信机制 | 委派工具 + 任务 context | 发布/订阅消息 |
| 协作粒度 | Task 级别 | Action 级别 |
| 路由方式 | 显式指定 coworker 或管理者分配 | 基于 cause_by 类型自动路由 |
| 灵活性 | 高（运行时委派决策） | 中（编译时订阅关系） |
| 确定性 | 低（LLM 决定委派对象） | 高（SOP 管道固定路径） |
| 循环协作 | 可能产生循环（需手动防止） | 内置循环控制（test_round_allowed） |

---

## 3. 工作流/流程引擎

### CrewAI

**Process 类型**:

| 类型 | 状态 | 任务分配 | 上下文传递 |
|------|------|----------|------------|
| **Sequential** | 可用 | 预定义顺序 | 前一个 Task 输出 → 下一个 Task 输入 |
| **Hierarchical** | 可用 | Manager Agent 动态分配 | Manager 审核并传递 |
| **Consensual** | 计划中 | 民主决策（TBD） | TBD |

**Sequential Process 执行逻辑**:
```
Task1(Agent A) → output → Task2(Agent B) → output → Task3(Agent C)
```
- 严格按 task list 定义顺序执行
- `context` 参数可跨越非相邻任务引用

**Hierarchical Process 执行逻辑**:
```
Manager Agent
├── 分析任务需求
├── 选择最合适的 Agent
├── 委派任务
├── 审核输出质量
└── 决定是否通过或重新分配
```
- 需配置 `manager_llm` 或 `manager_agent`
- 专家 Agent 的 `allow_delegation=False`（防止反向委派）

**Flow 引擎（高级编排）**:
- 位于 Crew 之上，编排多个 Crew 的执行
- 事件驱动: `@listen(method)` 在方法完成时触发
- 条件路由: `@router()` 根据返回值分流
- 人机交互: `@human_feedback` 暂停等待人类审批
- 状态持久化: `@persist` 自动保存到 SQLite
- 并行执行: 多个 `@start()` 方法并行启动

**AgentPlanner（预执行规划）**:
- `planning=True` 在每次执行前生成步骤计划
- 计划注入每个 Task 的 description
- 可配置独立的 `planning_llm`（默认 gpt-4o-mini）

### MetaGPT

**SOP 驱动工作流**:
```
UserRequirement
    ↓
ProductManager → PrepareDocuments → WritePRD
    ↓
Architect → WriteDesign（系统设计）
    ↓
ProjectManager → WriteTasks（任务拆解）
    ↓
Engineer → WriteCodePlanAndChange → WriteCode → SummarizeCode（循环）
    ↓
QaEngineer → WriteTest → RunCode → DebugError（循环，max 5 轮）
```

**执行机制**:
- `Team.run(n_round)` 控制执行轮数
- 每轮: 所有 Agent observe → think → act → publish
- 消息级联: Coder 产出 → Tester 激活 → Reviewer 激活
- Engineer 内部循环: Plan → Code → Summarize → (repeat if needed)
- QaEngineer 内部循环: WriteTest → RunCode → DebugError → (max 5 rounds)

**增量开发**:
- `config.inc=True` 启用增量模式
- Engineer 先生成 code plan，再编写变更代码
- 跟踪 `changed_files` 在源码、摘要、计划文档间

### 工作流对比总结

| 对比项 | CrewAI | MetaGPT |
|--------|--------|---------|
| 流程抽象 | Process 枚举 + Flow 事件引擎 | SOP 管道 + 消息级联 |
| 预定义流程 | Sequential + Hierarchical | 软件开发全流程 SOP |
| 自定义流程 | Flow 装饰器（高灵活性） | 自定义 Role + _watch（中等灵活性） |
| 内置循环 | 无原生支持（需 Flow 实现） | Engineer/QA 内置反馈循环 |
| 人机交互 | `@human_feedback` 装饰器 | 支持 human-in-the-loop |
| 增量执行 | Task replay（`crewai replay -t`） | 增量开发模式 |
| 预规划 | AgentPlanner（LLM 生成计划） | SOP 本身即为预定义计划 |

---

## 4. 权限与 RBAC

### CrewAI

**框架层**: 开源框架本身无 RBAC 概念

**CrewAI AMP（企业平台）**:
- `crewai org` CLI 支持组织管理: `list`, `current`, `switch`
- `crewai login` 支持多种 OAuth2 提供商: WorkOS, Okta, Auth0
- 可配置 `oauth2_provider`, `oauth2_audience`, `oauth2_client_id`, `oauth2_domain`
- Prompt Tracing 支持团队共享和合规审计
- 部署级别的环境变量隔离

**评估**: 有基础的组织/身份认证能力，但公开文档中未见细粒度 RBAC（角色权限矩阵、资源级控制等）

### MetaGPT

**框架层**: 无 RBAC 概念，纯开发框架

**Atoms 商业平台**:
- 基于信用额度的使用控制
- Free/Pro/Max 三级套餐（隐含使用限制）
- 无公开的 RBAC 或多租户文档

**评估**: 两者在权限管理方面都较弱，均需企业客户自行构建 RBAC 层

### 权限对比总结

| 对比项 | CrewAI | MetaGPT |
|--------|--------|---------|
| 框架级 RBAC | 无 | 无 |
| 企业平台认证 | OAuth2（WorkOS/Okta/Auth0） | 基本账户体系 |
| 组织管理 | CLI 组织切换 | 无 |
| 多租户 | 未公开 | 未公开 |
| 合规审计 | Prompt Tracing 导出 | 无 |

**对 ClawForce 的启示**: 权限与 RBAC 是明确的差异化机会。两个竞品都未在框架层面提供企业级权限控制，ClawForce 可以将此作为核心竞争力。

---

## 5. 非技术用户 UX

### CrewAI

**使用门槛**: 中等偏高
- 主要通过 Python 代码 + YAML 配置使用
- CLI 工具完善（`crewai create`, `crewai run`, `crewai chat`）
- `crewai chat` 提供交互式对话（需最少配置）
- YAML 配置降低了代码量，但仍需开发者操作

**UI 能力**:
- CrewAI AMP（app.crewai.com）提供 Web UI
- 支持部署管理、日志查看、Prompt Tracing 可视化
- 企业级 Tools Repository 提供可视化工具管理
- Flow 可视化: `flow.plot()` 生成 HTML 流程图

**非开发者可用性**: 低。核心功能需编写 Python/YAML，AMP 平台主要服务于开发运维而非终端业务用户。

### MetaGPT

**使用门槛**: 低（CLI）到中等（自定义）
- CLI 一行命令: `metagpt "Create a 2048 game"` 即可生成完整项目
- Python 库调用: `generate_repo()` 函数
- 自定义需理解 Role/Action/Message 编程模型

**UI 能力 — Atoms 平台**:
- 完整的 Web UI（Nuxt.js + PrimeVue）
- WYSIWYG 可视化编辑器
- AI Agent 团队协作界面（Mike/Emma/Bob/Alex/David/Iris/Sarah/Eve）
- 实时对话式交互
- 一键部署 + 代码导出
- 支持非技术用户直接使用

**非开发者可用性**: Atoms 平台面向非技术用户设计，但开源 MetaGPT 框架仍需开发者。

### UX 对比总结

| 对比项 | CrewAI | MetaGPT |
|--------|--------|---------|
| CLI 易用性 | 中（多步骤） | 高（一行命令） |
| Web UI | AMP（运维导向） | Atoms（用户导向） |
| 非开发者可用性 | 低 | 高（Atoms 平台） |
| 可视化编辑 | Flow 图 | WYSIWYG 编辑器 |
| 上手时间 | 数小时（需学 4 大概念） | 数分钟（CLI）/ 数小时（自定义） |

---

## 6. LLM 模型支持

### CrewAI

**原生 SDK 集成**（无需额外依赖）:

| 提供商 | 安装 | 代表模型 |
|--------|------|----------|
| OpenAI | `crewai[openai]` | GPT-4.1 (1M), GPT-4o, o1, o3-mini, o4-mini |
| Anthropic | `crewai[anthropic]` | Claude Sonnet 4 (200K), Claude Opus 4.6 |
| Google Gemini | `crewai[google-genai]` | Gemini 2.5 Flash/Pro (1M), Gemini 1.5 Pro (2M) |
| Azure | `crewai[azure-ai-inference]` | Azure OpenAI 模型 |
| AWS Bedrock | `crewai[bedrock]` | Nova, Claude, Llama, Titan, DeepSeek R1 |

**LiteLLM 集成**（需 `crewai[litellm]`）:
Meta-Llama, Google Vertex, Mistral, Nvidia NIM, Groq, IBM watsonx, Ollama, Fireworks, Perplexity, HuggingFace, SambaNova, Cerebras, OpenRouter, Nebius, Amazon SageMaker

**多模型配置**:
- Agent 级别独立配置 LLM
- `function_calling_llm` 单独配置工具调用模型（可用廉价模型降低成本）
- `planning_llm` 独立配置规划模型
- YAML 或 Python 代码均可配置

**本地模型**: Ollama + 本地 Nvidia NIM（WSL2）

**高级特性**:
- Extended Thinking（Claude Sonnet 4+）
- OpenAI Responses API（多模态 + 内置工具）
- 结构化输出（Pydantic model）
- 流式传输
- Transport Interceptors（请求/响应拦截）

### MetaGPT

**支持的 LLM 提供商**:
- OpenAI（api_type: openai）
- Azure（api_type: azure）
- Ollama（api_type: ollama，专用 OllamaLLM 适配器）
- 通用 OpenAI 兼容（api_type: open_llm）— 支持 LLaMA-Factory, FastChat, vLLM
- Groq 及其他

**Atoms 平台支持的模型**:
- OpenAI: GPT-4o mini, GPT-4o, GPT-5
- Anthropic: Claude Sonnet 3.7 ~ Claude Opus 4.6
- Google: Gemini 2.5 Flash/Pro ~ Gemini 3.1 Pro Preview
- DeepSeek: V3, V3.2, V3.2-Exp
- 阿里云: Qwen3 Coder Plus
- 智谱: GLM-4.7, GLM-5

**多模型配置**:
- 支持按 Role 或 Action 自定义 LLM
- `config2.yaml` 中配置多个 LLM provider

**本地模型**: Ollama, LLaMA-Factory, FastChat, vLLM

**特殊功能**:
- `repair_llm_output: true` — 自动修复开源模型的格式错误输出
- `prompt_schema: json | markdown` — 适配不同模型的 prompt 格式

### LLM 支持对比总结

| 对比项 | CrewAI | MetaGPT |
|--------|--------|---------|
| 原生提供商数量 | 5 原生 + 15+ LiteLLM | 5+ 直接 + OpenAI 兼容 |
| 多模型粒度 | Agent 级 + 工具调用级 + 规划级 | Role 级 + Action 级 |
| 本地模型 | Ollama + Nvidia NIM | Ollama + vLLM + LLaMA-Factory + FastChat |
| 开源模型适配 | 依赖 LiteLLM 兼容层 | 内置输出修复（repair_llm_output） |
| 高级 LLM 特性 | Extended Thinking, Responses API | prompt_schema 适配 |
| 配置便利性 | YAML / Python / ENV 三种方式 | YAML 为主 |

---

## 7. 渠道/集成生态

### CrewAI

**工具集成（30+ 内置工具）**:

| 类别 | 工具 |
|------|------|
| Web/搜索 | SerperDev, EXASearch, WebsiteSearch, ScrapeWebsite |
| 文件处理 | FileRead, DirectoryRead, DirectorySearch |
| RAG 结构化 | CSVSearch, JSONSearch, XMLSearch, PGSearch |
| RAG 文档 | PDFSearch, DOCXSearch, TXTSearch, MDXSearch, CodeDocs |
| 媒体/视觉 | DALL-E, Vision, YouTubeChannel/Video Search |
| 爬虫 | Firecrawl (Search/Crawl/Scrape), Browserbase |
| 代码 | CodeInterpreter, GithubSearch |
| 外部平台 | Apify, Composio, LlamaIndex |

**LangChain 工具兼容**: 完全支持 LangChain Tools 生态

**API/Webhook**:
- `kickoff()` / `akickoff()` 编程式调用
- CrewAI AMP 提供部署后的 API 端点
- 事件系统（Event Bus）可对接外部监控

**CLI 工具**: 完善的 CLI（create, run, deploy, test, train, chat, replay）

### MetaGPT

**内置工具**:
- Browser（网页浏览）
- Editor（文件读写 + 相似搜索）
- Terminal（命令执行）
- SearchEnhancedQA（搜索增强问答）

**集成能力**:
- RAG 模块
- 工具创建和使用框架
- Data Interpreter（Jupyter Notebook 代码执行环境）
- 支持与 Open LLM 的部署框架集成

**Atoms 平台集成**:
- Stripe 支付集成
- GitHub Sync（代码导出）
- 内置 AI 模型 API（Gemini, GPT 等）
- PostHog/Sentry 分析
- Intercom 客服

### 集成生态对比总结

| 对比项 | CrewAI | MetaGPT |
|--------|--------|---------|
| 内置工具数量 | 30+ | 5-6 |
| 第三方工具兼容 | LangChain 全生态 | 自建工具框架 |
| API 成熟度 | 高（AMP 平台 + 事件系统） | 低（主要通过代码调用） |
| 自定义工具 | BaseTool 子类 + @tool 装饰器 | Action 子类 |
| 企业集成 | AMP Tools Repository | Atoms 商业集成 |

---

## 8. 记忆/知识库

### CrewAI

**统一 Memory 系统**（v1.x 重构）:

| 特性 | 详情 |
|------|------|
| 架构 | 单一 Memory 类替代原来的 short-term/long-term/entity/user 分离 |
| 核心 API | `remember()`, `recall()`, `extract_memories()` |
| 存储后端 | LanceDB（默认），支持自定义 StorageBackend |
| 嵌入 | 13 种提供商（OpenAI 默认） |
| 层次作用域 | 树状结构（如 `/project/alpha`, `/agent/researcher`） |
| 隐私控制 | `private` 标志 + `source` 标签 |

**Recall 评分公式**:
```
composite = semantic_weight(0.5) x similarity + recency_weight(0.3) x decay + importance_weight(0.2) x importance
```
- 半衰期: 30 天指数衰减
- 两种深度: Shallow（纯向量搜索，~200ms）、Deep（多步 RecallFlow + LLM 分析）

**去重与合并**:
- 保存时检查相似记录（阈值 0.85）
- LLM 决定 keep/update/delete/insert
- 批量操作中 cosine >= 0.98 直接去重

**Knowledge 系统**:

| 知识源类型 | 格式 |
|------------|------|
| 文本 | String, TXT, PDF, Web URL (Docling) |
| 结构化 | CSV, Excel, JSON |
| 自定义 | 继承 BaseKnowledgeSource |

- 两级知识: Agent 级（私有）+ Crew 级（共享）
- RAG 客户端: ChromaDB（默认）、Qdrant
- 查询重写: LLM 自动优化搜索查询

### MetaGPT

**Memory 系统**:
- Role 内置 Memory，通过 `self.get_memories(k=N)` 检索
- 每步交互自动存储到 Memory
- `enable_memory` 可按 Role 开关
- 长期记忆: `enable_longterm_memory: true`（配置项）

**知识管理**:
- RAG 模块（文档未详述具体实现）
- Editor 工具支持 `similarity_search`
- Data Interpreter 的 Jupyter 环境支持数据持久化
- 序列化与断点恢复

### 记忆/知识对比总结

| 对比项 | CrewAI | MetaGPT |
|--------|--------|---------|
| Memory 架构 | 统一 Memory（成熟） | 基础 Memory + 可选长期记忆 |
| 存储后端 | LanceDB（高性能向量库） | 未公开具体实现 |
| 知识源类型 | 7+ 种（PDF/CSV/Excel/JSON/TXT/Web/自定义） | RAG 模块 + 文件系统 |
| 评分机制 | 复合评分（语义+时间+重要性） | 基本检索 |
| 作用域控制 | 层次化（树状） | Role 级别 |
| 去重/合并 | LLM 驱动去重 | 无 |
| 跨会话持久化 | LanceDB 持久化 | 序列化 + 断点恢复 |

---

## 9. 扩展性/插件系统

### CrewAI

**自定义工具**:
```python
# 方式1: BaseTool 子类
class MyTool(BaseTool):
    name: str = "My Tool"
    description: str = "What this tool does"
    args_schema: Type[BaseModel] = MyToolInput
    def _run(self, argument: str) -> str:
        return "result"

# 方式2: @tool 装饰器
@tool("My Tool")
def my_tool(argument: str) -> str:
    """Tool description (critical for agent usage)"""
    return "result"
```

**Agent 扩展**:
- 自定义 system_template / prompt_template / response_template
- reasoning=True 启用反思推理
- multimodal=True 启用多模态
- 自定义 knowledge_sources
- 自定义 embedder

**Flow 扩展**:
- 自定义 FlowPersistence 后端
- 自定义 StorageBackend
- 事件监听器（BaseEventListener）
- Scoped handlers（临时监听）

**企业扩展（AMP）**:
- Tools Repository（预置企业连接器）
- 自定义工具创建界面
- 版本控制与共享
- 安全/合规特性

### MetaGPT

**自定义 Action**:
```python
class MyAction(Action):
    PROMPT_TEMPLATE = "Given {input}, produce {output}"

    async def run(self, input_data: str):
        prompt = self.PROMPT_TEMPLATE.format(input=input_data)
        result = await self._aask(prompt)
        return result
```

**自定义 Role**:
```python
class MyRole(Role):
    name: str = "CustomRole"
    profile: str = "Custom Profile"
    goal: str = "Custom goal"

    def __init__(self):
        super().__init__()
        self.set_actions([MyAction1, MyAction2])
        self._watch([UpstreamAction])
        self._set_react_mode("by_order")
```

**扩展能力**:
- 自定义 Environment（Werewolf, Stanford Town, Minecraft, Android）
- 工具创建框架
- 多种 react_mode 可选
- 自定义 SOP 管道

### 扩展性对比总结

| 对比项 | CrewAI | MetaGPT |
|--------|--------|---------|
| 工具扩展 | BaseTool + @tool（简洁） | Action 子类（灵活） |
| Agent 扩展 | 属性配置式（低代码） | 类继承式（需编码） |
| 流程扩展 | Flow 装饰器（声明式） | _watch 订阅（命令式） |
| 环境扩展 | 无 | 多种 Environment |
| 企业插件市场 | AMP Tools Repository | 无 |
| LangChain 兼容 | 完全兼容 | 不兼容 |

---

## 10. 部署模式

### CrewAI

| 部署方式 | 详情 |
|----------|------|
| **本地运行** | `pip install crewai` → `crewai run` |
| **CrewAI AMP** | `crewai deploy create` → `crewai deploy push`（托管云平台） |
| **Docker** | 支持（Agent 代码执行的安全模式使用 Docker 沙箱） |
| **自定义部署** | 作为 Python 库嵌入任何应用 |

**AMP 部署流程**:
1. `crewai login`（OAuth2 认证）
2. `crewai deploy create`（检测环境变量 + 关联 GitHub）
3. `crewai deploy push`（构建镜像 + 部署）
4. `crewai deploy status` / `crewai deploy logs`（监控）

### MetaGPT

| 部署方式 | 详情 |
|----------|------|
| **本地运行** | `pip install metagpt` → `metagpt "prompt"` |
| **Docker** | 官方 Docker 支持 |
| **Atoms 平台** | 完全托管的 SaaS（含后端基础设施） |
| **自定义部署** | 作为 Python 库嵌入 |

**Atoms 部署能力**:
- 一键部署到 Atoms Cloud
- 内置 Auth + Database + Stripe
- 4 CPU / 16Gi Memory / 10Gi Storage（Max 套餐）
- 代码导出 + GitHub Sync

### 部署对比总结

| 对比项 | CrewAI | MetaGPT |
|--------|--------|---------|
| 本地运行 | 简单 | 简单（需 Node.js 额外依赖） |
| 云平台 | AMP（Agent 编排平台） | Atoms（应用构建平台） |
| 容器化 | Docker 支持 | Docker 支持 |
| Kubernetes | 未明确 | 未明确 |
| 自托管企业版 | 未公开 | 未公开 |
| 部署 CLI | 完善（deploy create/push/status/logs） | 通过 Atoms UI |

---

## 11. 开源与定价

### CrewAI

**开源**:
- License: MIT
- Stars: 44.8k | Forks: 6k | Contributors: 未公开
- Commits: 2,016
- Open Issues: 64 | Open PRs: 286
- 社区: 100,000+ 开发者认证，community.crewai.com
- 学习: learn.crewai.com + DeepLearning.ai 合作课程

**商业产品 — CrewAI AMP Suite**:
- 免费层可用（app.crewai.com）
- 企业功能: Prompt Tracing, Tools Repository, 部署管理
- 定价: 未公开具体价格（需联系销售）

### MetaGPT

**开源**:
- License: MIT
- Stars: 64.6k | Forks: 8.1k | Contributors: 112
- Commits: 6,367 | Releases: 22
- 学术认可: ICLR 2024 论文 + AFlow ICLR 2025 Oral（top 1.8%）
- 组织: FoundationAgents（GitHub）

**商业产品 — Atoms**:
- 免费层: 2,500,000 credits/月 + 2GB 存储
- Pro: $20-$500/月（10M-250M credits）
- Max: $100-$3,000/月（50M-1.5B credits，增强算力）
- 年付约 18% 折扣
- 支付: 信用卡 + Alipay + Amazon Pay

### 开源/定价对比总结

| 对比项 | CrewAI | MetaGPT |
|--------|--------|---------|
| 开源协议 | MIT | MIT |
| GitHub 热度 | 44.8k stars | 64.6k stars |
| 社区规模 | 100K+ 认证开发者 | 112 贡献者 |
| 更新频率 | 高（v1.9.3，2026-01 发布） | 中（v0.8.2，2025-03 发布） |
| 学术影响 | 无 | ICLR 2024/2025 论文 |
| 免费层 | AMP 免费层 | Atoms 2.5M credits/月 |
| 企业定价 | 未公开 | $20-$3,000/月 |
| 收入模式 | 企业 SaaS + 咨询 | Credit 消耗制 SaaS |

---

## 12. 软件团队模拟能力

### CrewAI

**原生支持程度**: 低 — 需要用户自行配置

CrewAI 没有预置软件开发团队角色，但提供了灵活的框架来构建:

```yaml
# 需用户自行定义
product_manager:
  role: "Product Manager"
  goal: "Define clear product requirements and user stories"
  backstory: "Experienced PM with 10+ years in software products..."

developer:
  role: "Senior Software Developer"
  goal: "Write clean, tested, production-ready code"
  backstory: "Full-stack developer proficient in..."

qa_engineer:
  role: "QA Engineer"
  goal: "Ensure software quality through comprehensive testing"
  backstory: "Quality assurance specialist with expertise in..."
```

**可实现的能力**:
- Hierarchical Process 模拟团队管理结构
- Flow 编排多阶段开发流程
- Task guardrails 实现质量门禁
- Agent delegation 模拟角色间协作
- Knowledge sources 提供技术文档上下文

**局限性**:
- 无预定义 SOP
- 无内置代码生成/审查/测试执行管道
- 需自行构建全部开发流程逻辑
- 任务委派依赖 LLM 决策（非确定性）

### MetaGPT

**原生支持程度**: 高 — 核心设计目标

**预置软件团队角色**:

| 角色 | 名称 | 核心 Actions | SOP 触发 |
|------|------|-------------|----------|
| **ProductManager** | Alice | PrepareDocuments, WritePRD | UserRequirement |
| **Architect** | Bob | WriteDesign | WritePRD |
| **ProjectManager** | Eve | WriteTasks | WriteDesign |
| **Engineer** | Alex | WriteCodePlanAndChange, WriteCode, SummarizeCode | WriteTasks |
| **QaEngineer** | Edward | WriteTest, RunCode, DebugError | SummarizeCode |

**SOP 驱动的开发管道**:

```
用户一行需求
    ↓
ProductManager(Alice):
├── PrepareDocuments（初始化 Git 仓库）
└── WritePRD（生成产品需求文档）
    ↓
Architect(Bob):
└── WriteDesign（系统设计 + API 定义 + 数据结构）
    ↓
ProjectManager(Eve):
└── WriteTasks（任务拆解 + 依赖分析）
    ↓
Engineer(Alex):
├── WriteCodePlanAndChange（增量开发计划）
├── WriteCode（逐文件编码）
└── SummarizeCode（代码质量评估，循环）
    ↓
QaEngineer(Edward):
├── WriteTest（生成单元测试）
├── RunCode（执行测试）
└── DebugError（修复失败测试，max 5 轮循环）
```

**产出物**:
- 产品需求文档（PRD）
- 竞品分析
- 用户故事
- 系统设计文档
- API 定义
- 数据结构设计
- 项目代码（完整可运行）
- 单元测试

**Engineer 内部循环细节**:
- 解析任务文档，为每个文件创建 `CodingContext`
- 包含设计文档、任务文档、已有代码作为上下文
- 可选 Code Review（`use_code_review=True`）
- SummarizeCode 使用 LLM 评估通过/失败
- `max_auto_summarize_code` 控制循环上限

**QaEngineer 内部循环细节**:
- 过滤非 Python 文件和已有测试文件
- 创建 `TestingContext` 包含源码和测试依赖
- `RunCode` 执行测试并保存 JSON 结果
- `DebugError` 基于错误输出修复测试
- `test_round_allowed=5` 限制最大轮数

**增量开发**:
- `config.inc=True` 启用
- 先生成 code plan 再编码
- 跟踪变更文件列表
- 支持断点恢复和序列化

**成本**:
- GPT-4 完整项目约 $2.0
- 分析设计阶段约 $0.2

### 软件团队模拟对比总结

| 对比项 | CrewAI | MetaGPT |
|--------|--------|---------|
| 预置开发角色 | 无 | PM + Architect + ProjMgr + Engineer + QA |
| SOP 管道 | 需自建 | 开箱即用 |
| 代码生成 | 需集成工具 | 原生（逐文件 + 上下文感知） |
| 测试执行 | 需集成工具 | 原生（WriteTest → RunCode → DebugError） |
| 代码审查 | 无 | 可选（use_code_review） |
| 增量开发 | 无 | 原生支持 |
| 产出物完整度 | 取决于配置 | PRD → 设计 → 代码 → 测试全链路 |
| 团队循环反馈 | 委派工具（非确定性） | 消息路由（确定性） |
| 项目管理 | 无 | Git 仓库 + 任务拆解 |
| 与 ClawForce 场景匹配 | 需大量定制 | 高度匹配 |

---

## 综合对比矩阵

| 维度 | CrewAI | MetaGPT | ClawForce 启示 |
|------|--------|---------|----------------|
| **1. 架构模式** | 灵活通用框架 | SOP 驱动专用框架 | 需要兼具灵活性和 SOP 确定性 |
| **2. 多 Agent 协作** | 委派工具 + 上下文链 | 发布/订阅 + 消息路由 | 建议结合两者: 确定性 SOP + 灵活委派 |
| **3. 工作流引擎** | Flow 事件引擎（强大灵活） | SOP 管道（开发专用） | Flow 级编排 + 领域 SOP 预设 |
| **4. 权限 RBAC** | 基础 OAuth2 | 无 | **核心差异化机会** |
| **5. 非技术 UX** | 弱（开发者导向） | 强（Atoms 面向用户） | 需要强 UI/UX 层 |
| **6. LLM 支持** | 极广（30+ 提供商） | 广（10+ 提供商） | CrewAI 模式更优 |
| **7. 集成生态** | 丰富（30+ 工具 + LangChain） | 基础（5-6 内置工具） | 需要丰富的集成 |
| **8. 记忆/知识** | 成熟（统一 Memory + Knowledge） | 基础 | CrewAI 架构可参考 |
| **9. 扩展性** | 高（声明式 + 插件市场） | 中（类继承） | 需要插件生态 |
| **10. 部署模式** | AMP 云 + 本地 | Atoms 云 + 本地 | 需支持私有部署 |
| **11. 开源/定价** | MIT + 企业 SaaS | MIT + Credit SaaS | 开源核心 + 企业增值 |
| **12. 软件团队模拟** | 需自建 | **核心能力（原生）** | 直接竞争 MetaGPT 优势领域 |

---

## 对 ClawForce 的战略建议

### 应该从 CrewAI 借鉴的

1. **Flow 事件引擎**: 声明式工作流编排 + 状态管理 + 持久化，成熟度高
2. **统一 Memory 系统**: 复合评分 + 层次作用域 + 去重合并
3. **LLM 抽象层**: 多提供商原生支持 + Agent 级多模型配置
4. **工具生态**: 30+ 内置工具 + LangChain 兼容 + 企业工具市场
5. **事件系统**: 完善的可观测性基础设施
6. **Task Guardrails**: 输出验证机制（函数式 + LLM 式）

### 应该从 MetaGPT 借鉴的

1. **SOP 驱动管道**: 确定性的软件开发流程（核心竞争力）
2. **预置角色体系**: PM/Architect/Engineer/QA 完整角色定义
3. **发布/订阅通信**: `_watch` 机制实现解耦的 Agent 协作
4. **内置反馈循环**: Engineer 循环（Code → Review → Refine）+ QA 循环（Test → Debug → Retest）
5. **增量开发**: code plan → code change 的渐进式开发模式
6. **完整产出链**: 需求 → 设计 → 代码 → 测试的全链路交付物

### ClawForce 的差异化方向

1. **企业级 RBAC**: 两个竞品都缺失的能力——角色权限矩阵、资源级控制、审计日志
2. **多租户架构**: 原生多组织支持、数据隔离、资源配额
3. **人机协同深度**: 超越简单的 human-in-the-loop，实现 PM 审批流、代码 Review 门禁、QA 签收
4. **可观测 SOP**: 将 MetaGPT 的隐式 SOP 可视化，让管理者能看到团队执行状态
5. **混合模式**: 确定性 SOP（保障流程质量）+ 灵活委派（处理异常情况）
6. **企业集成**: 对接 Jira/Linear/GitHub/GitLab/Slack 等企业工具链
7. **私有部署**: 支持 Kubernetes 自托管，满足数据合规需求

---

## 数据来源

| 来源 | URL |
|------|-----|
| CrewAI 文档 | https://docs.crewai.com |
| CrewAI GitHub | https://github.com/crewAIInc/crewAI |
| CrewAI PyPI | https://pypi.org/project/crewai/ |
| MetaGPT GitHub | https://github.com/geekan/MetaGPT |
| MetaGPT 文档 | https://docs.deepwisdom.ai |
| MetaGPT PyPI | https://pypi.org/project/metagpt/ |
| Atoms (MGX) | https://atoms.dev |
