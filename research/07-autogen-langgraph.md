# AutoGen vs LangGraph 深度竞品分析

> 为 ClawForce 企业级 AI 员工平台建设提供的竞品调研报告
> 调研日期：2026-02-28 | 数据来源：官方文档 + GitHub 仓库

---

## 总览对比矩阵

| 维度 | AutoGen (Microsoft) | LangGraph (LangChain) |
|------|--------------------|-----------------------|
| 定位 | 多Agent对话协作框架 | 低层级有状态Agent编排引擎 |
| 版本 | 0.4.x (稳定) / 0.2 (遗留) | 1.x (稳定) |
| 核心抽象 | Agent + Team + Message | StateGraph + Node + Edge |
| 编程模型 | 面向对话 (Conversational) | 面向图 (Graph-based) |
| 开源协议 | MIT (代码) / CC BY 4.0 (文档) | MIT |
| 语言支持 | Python + .NET (多语言互操作) | Python + JS/TS |
| GitHub Stars | ~40k+ | ~15k+ |

---

## 1. 架构模式

### AutoGen 0.4+ 新架构

AutoGen 采用**分层架构**，从底层到顶层依次为：

```
┌─────────────────────────────────┐
│      AutoGen Studio (UI)         │  低代码原型设计
├─────────────────────────────────┤
│      AgentChat (高层 API)        │  对话式多Agent应用
├─────────────────────────────────┤
│      Core (事件驱动运行时)        │  可扩展Agent系统基础
├─────────────────────────────────┤
│      Extensions (扩展包)         │  外部服务/库集成
└─────────────────────────────────┘
```

**核心概念**：
- **Actor 模型**：Core 层基于 Actor 模型实现，Agent 之间通过异步消息传递通信
- **事件驱动**：支持事件驱动和请求/响应两种通信模型
- **Topic 和 Subscription**：用于管理消息路由模式
- **Agent Identity 和 Lifecycle**：完整的 Agent 身份管理和生命周期管理
- **Python 3.10+**，async/await 原生支持

**vs 0.2 经典版的关键变化**：
- 0.2 中工具执行由独立 Agent 完成；0.4 中 AssistantAgent 直接执行工具
- 从面向类继承转向面向协议（Protocol-based）设计
- 新增 Core 层支持分布式部署
- 引入 Team 抽象替代旧的 GroupChat 概念
- 组件可序列化（`dump_component()` / `load_component()`）

### LangGraph 架构

LangGraph 采用**图计算模型**，灵感来自 Google Pregel 系统和 Apache Beam：

```
┌─────────────────────────────────┐
│   LangSmith Agent Server         │  托管部署平台
├─────────────────────────────────┤
│   LangGraph (图编排引擎)          │  有状态工作流编排
├─────────────────────────────────┤
│   LangChain (可选集成层)          │  组件和工具集成
└─────────────────────────────────┘
```

**核心概念**：
- **StateGraph**：以状态模式（TypedDict/dataclass/Pydantic）参数化的有向图
- **Super-step 执行**：基于 Pregel 消息传递，节点在离散"超级步"中处理消息
- **Reducer**：每个状态键有独立的 reducer 函数控制更新方式
- **Checkpoint**：内建持久化机制，支持断点续传
- **独立于 LangChain**：虽然由 LangChain Inc 构建，但可完全独立使用

**设计哲学差异**：LangGraph 刻意保持低层级，"不抽象 prompt 或架构"，将这些决策留给开发者。

### 对 ClawForce 的启示

| 考量 | AutoGen 优势 | LangGraph 优势 |
|------|-------------|----------------|
| 快速原型 | Agent 即对话参与者，开发直觉 | 图可视化，执行路径清晰 |
| 生产就绪 | Core 层支持分布式 | 内建持久化和故障恢复 |
| 灵活度 | 多种 Team 预设模式 | 任意图拓扑 + 条件路由 |
| 学习曲线 | 较低（对话隐喻自然） | 中等（需理解图计算模型） |

---

## 2. 多 Agent 协作

### AutoGen Agent 类型

| Agent 类型 | 使用 LLM | 使用工具 | 执行代码 | 人类输入 | 多模态 |
|-----------|---------|---------|---------|---------|--------|
| AssistantAgent | Yes | Yes | No | No | Yes |
| CodeExecutorAgent | No | No | Yes | No | No |
| UserProxyAgent | No | No | No | Yes | No |
| MultimodalWebSurfer | Yes | Yes | No (浏览器) | No | Yes |
| MagenticOneCoderAgent | Yes | No | No | No | No |

**AssistantAgent** 是"厨房水槽"型 Agent：
- 支持工具调用、多模态输入、系统消息配置
- 工具在同一 `run()` 调用中直接执行（不再需要独立的执行 Agent）
- 消息流：TextMessage -> ToolCallRequestEvent -> ToolCallExecutionEvent -> ToolCallSummaryMessage
- 有状态：`run()` 会将消息追加到内部历史

### AutoGen Team 协作模式

| 模式 | 说话者选择 | 决策方式 | 适用场景 |
|------|-----------|---------|---------|
| RoundRobinGroupChat | 固定轮询 | 预定义顺序 | 简单反馈循环、审核流程 |
| SelectorGroupChat | LLM 模型选择 | 集中式编排 | 动态复杂对话 |
| Swarm | HandoffMessage | 去中心化 | Agent 自主委派 |
| MagenticOneGroupChat | Orchestrator 指挥 | 层级式 | 开放式 Web/文件任务 |
| GraphFlow | 有向图定义 | 确定性控制 | 严格工作流 |

**SelectorGroupChat 详解**：
- 使用 LLM 分析对话上下文 + Agent 名称/描述来选择下一个说话者
- 可自定义 `selector_prompt` 模板（含 `{participants}`、`{roles}`、`{history}` 变量）
- 支持 `selector_func` 硬覆盖和 `candidate_func` 候选过滤
- 默认不允许同一 Agent 连续发言（`allow_repeated_speaker=False`）

**Swarm 详解**：
- 通过 `HandoffMessage` 实现 Agent 间转移
- 每个 Agent 配置 `handoffs` 参数指定可委派目标
- 支持 `handoff to "user"` 暂停执行等待人类输入
- 去中心化：每个 Agent 自主决定委派给谁

**Magentic-One 详解**：
- 层级式架构：Orchestrator + 4 个专业 Agent（WebSurfer, FileSurfer, Coder, ComputerTerminal）
- 双循环机制：外循环（Task Ledger 高层计划）+ 内循环（Progress Ledger 进度追踪）
- Orchestrator 负责任务分解、子任务委派、进度监控和纠偏
- 模型无关：支持异构模型配置（如 o1 用于推理，GPT-4o 用于执行）

### LangGraph 多 Agent 模式

LangGraph 的多 Agent 协作通过图结构实现：

**Orchestrator-Worker 模式**：
```python
# Orchestrator 分解任务，通过 Send API 动态创建 Worker
def orchestrator(state):
    return [Send("worker", {"section": s}) for s in state["sections"]]
```

**关键机制**：
- **状态共享**：Agent（节点）通过共享的 StateGraph 状态通信
- **并行执行**：一个节点多条出边时，所有目标节点并行执行
- **Send API**：用于 map-reduce 模式，动态创建并行任务分支
- **Command**：在单个返回值中组合控制流和状态更新
- **子图（Subgraph）**：将子图作为节点嵌入父图，通过 `Command(graph=Command.PARENT)` 从子图导航到父图

**与 AutoGen 对比**：

| 能力 | AutoGen | LangGraph |
|------|---------|-----------|
| 预设协作模式 | 5种（RoundRobin/Selector/Swarm/Magentic-One/GraphFlow） | 无预设，自由图编排 |
| Agent 间通信 | 广播消息 + 共享上下文 | 共享 State + 消息传递 |
| 动态编排 | SelectorGroupChat (LLM决策) | conditional_edge + Send API |
| 层级编排 | Magentic-One (Orchestrator) | 子图嵌套 |
| 去中心化 | Swarm (HandoffMessage) | 条件边 + 节点自主路由 |

---

## 3. 工作流/流程引擎

### AutoGen GraphFlow

GraphFlow 是 AutoGen 的**实验性**图工作流引擎：

```python
builder = DiGraphBuilder()
builder.add_node(agent_a).add_node(agent_b).add_node(agent_c)
builder.add_edge(agent_a, agent_b)
builder.add_edge(agent_b, agent_c, condition=lambda msg: "APPROVE" in msg.to_model_text())
builder.add_edge(agent_b, agent_a, condition=lambda msg: "APPROVE" not in msg.to_model_text())
graph = builder.build()
flow = GraphFlow(participants=builder.get_participants(), graph=graph)
```

**特性**：
- 支持顺序、并行（Fan-out/Fan-in）、条件分支、循环
- 条件边支持字符串匹配和 lambda 函数
- `activation_group` + `activation_condition`（all/any）控制多入边依赖
- 消息过滤（`MessageFilterAgent`）控制 Agent 接收的消息范围
- 状态：**实验性**，API 可能变更

### LangGraph StateGraph

LangGraph 的图引擎是其**核心产品**：

```python
class State(TypedDict):
    messages: Annotated[list, add_messages]
    approved: bool

graph = StateGraph(State)
graph.add_node("agent", agent_node)
graph.add_node("reviewer", reviewer_node)
graph.add_conditional_edges("agent", route_fn, {"approve": "reviewer", "reject": END})
graph.add_edge(START, "agent")
compiled = graph.compile(checkpointer=MemorySaver())
```

**核心能力**：
- **状态模式**：TypedDict / dataclass / Pydantic BaseModel，支持 InputState, OutputState, PrivateState 多模式分离
- **Reducer**：每个状态键独立 reducer（默认覆盖，可配置为追加等）
- **条件边**：`add_conditional_edges(source, router_fn, path_map)` 路由函数返回目标节点名
- **并行执行**：多出边 = 自动并行
- **Send API**：动态 map-reduce，运行时确定分支数
- **Command**：组合控制流 + 状态更新，支持跨子图导航
- **编译**：`compile()` 执行结构校验，配置 checkpointer 和断点
- **递归限制**：默认 1000 超级步，可配置 `recursion_limit`
- **节点缓存**：`CachePolicy` 支持 `key_func` 和 `ttl`
- **Runtime Context**：`context_schema` 传递依赖（模型名、DB连接等）

### 对比总结

| 能力 | AutoGen GraphFlow | LangGraph StateGraph |
|------|-------------------|---------------------|
| 成熟度 | 实验性 | 核心产品，生产就绪 |
| 状态管理 | 依赖 Agent 内部状态 | 一等公民，Reducer + Checkpoint |
| 条件路由 | lambda 条件边 | 路由函数 + path_map |
| 并行执行 | Fan-out/Fan-in | 多出边自动并行 + Send API |
| 循环支持 | 支持（需设入口点） | 原生支持 |
| 持久化 | 手动 save_state/load_state | 内建 Checkpointer |
| 子图 | 不支持 | 支持嵌套子图 + 跨图导航 |
| 消息过滤 | MessageFilterAgent | Private State |
| 故障恢复 | 无内建 | Checkpoint 自动恢复 |

---

## 4. 权限与 RBAC

### AutoGen

- **框架层面**：AutoGen 本身**不提供**内建的权限模型或 RBAC
- **AutoGen Studio**：明确声明"not meant to be a production-ready app"，没有实现认证、授权等安全特性
- **建议**：官方建议开发者使用底层框架自行实现安全机制
- **代码执行安全**：Docker 沙箱执行（`DockerCommandLineCodeExecutor`）

### LangGraph

- **LangGraph OSS**：开源版本本身不包含 RBAC
- **LangSmith Platform (Enterprise)**：
  - 自定义 SSO 认证
  - 基于组织角色的 RBAC
  - 自定义认证中间件
  - 多租户访问控制
  - 自定义路由和中间件注入
- **线程级隔离**：每个线程（thread）有独立状态，天然支持用户级隔离

### 对 ClawForce 的启示

两个框架在 OSS 层面都**不提供**企业级权限管理。ClawForce 需要自建 RBAC 层。LangGraph 在平台层提供了更多企业特性参考。

---

## 5. 非技术用户 UX

### AutoGen Studio

AutoGen Studio 是一个**低代码界面**，提供四大功能：

1. **Team Builder**：可视化界面 + JSON 声明式 + 拖拽式创建 Agent 团队
2. **Playground**：交互式测试环境，支持实时消息流、可视化控制转移图、Agent 交互
3. **Gallery**：社区组件发现和导入中心
4. **Deployment**：导出 Python 代码、设置 API 端点、Docker 容器部署

**定位**：原型设计工具，源自 2023 年 10 月的研究原型，已在 EMNLP 2024 发表论文
**限制**：明确不是生产就绪应用，缺少认证/安全/细粒度访问控制

### LangGraph

- **LangGraph Studio**：连接到任何 Agent Server（本地或已部署），提供交互式开发、调试、图可视化、状态检查
- **Agent Builder**（LangSmith 内）：
  - Developer 免费版：1 个 Agent，每月 50 次运行
  - Plus 版：无限 Agent，每月 500 次运行
- **LangSmith 追踪**：深度可视化 Agent 行为、调试支持

### 对比

| 能力 | AutoGen Studio | LangGraph Studio + LangSmith |
|------|---------------|------------------------------|
| 可视化构建 | 拖拽 + JSON 声明式 | Agent Builder (云端) |
| 实时调试 | Playground 消息流 | LangSmith 追踪 + Studio 状态检查 |
| 社区生态 | Gallery 组件中心 | LangChain Hub |
| 非技术用户门槛 | 中低（拖拽式） | 中高（仍偏开发者） |
| 生产就绪 | 明确不是 | Studio 可连接生产 Server |

---

## 6. LLM 模型支持

### AutoGen

AutoGen 通过 `autogen-ext` 提供多提供商支持：

| 提供商 | Client 类 | 状态 | 包名 |
|-------|----------|------|------|
| OpenAI | `OpenAIChatCompletionClient` | 稳定 | `autogen-ext[openai]` |
| Azure OpenAI | `AzureOpenAIChatCompletionClient` | 稳定 | `autogen-ext[openai,azure]` |
| Azure AI Foundry | `AzureAIChatCompletionClient` | 稳定 | `autogen-ext[azure]` |
| Anthropic | `AnthropicChatCompletionClient` | 实验性 | `autogen-ext[anthropic]` |
| Ollama (本地) | `OllamaChatCompletionClient` | 实验性 | `autogen-ext[ollama]` |
| Gemini | 通过 OpenAI 兼容 API | 实验性 | `autogen-ext[openai]` |
| Llama API | 通过 OpenAI 兼容 API | 实验性 | `autogen-ext[openai]` |
| Semantic Kernel 适配器 | `SKChatCompletionAdapter` | 稳定 | 多个 SK 子包 |

**SK 适配器**额外支持：Anthropic、Google、Ollama、Mistral AI、AWS Bedrock、Hugging Face

**异构模型配置**：支持在同一 Team 中为不同 Agent 配置不同模型（如 Magentic-One 中 Orchestrator 用 o1，其他 Agent 用 GPT-4o）

**模型缓存**：`ChatCompletionCache` 包装器支持缓存模型调用结果

### LangGraph

LangGraph 本身**模型无关**——它是编排层，不直接处理 LLM 调用。模型支持来自：

- **LangChain 集成**：通过 `langchain-openai`、`langchain-anthropic`、`langchain-google-genai` 等包支持几乎所有主流 LLM
- **直接调用**：节点函数中可使用任何 LLM SDK
- **支持范围**：OpenAI、Anthropic、Google、AWS Bedrock、Azure、Ollama、vLLM、HuggingFace、Cohere、Mistral 等 50+ 提供商

**实质区别**：AutoGen 在框架内定义了统一的 model client 协议；LangGraph 对 LLM 调用完全透明，依赖 LangChain 生态或开发者自选 SDK。

---

## 7. 渠道/集成生态

### AutoGen

- **MCP 集成**：`mcp_server_tools()` 函数支持 Model Context Protocol 服务器集成
- **OpenAI Assistants API**：`OpenAIAssistantAgent` 直接使用 OpenAI Assistant
- **GraphRAG**：`GraphRAGLocalSearchTool` 集成微软 GraphRAG
- **Docker**：`DockerCommandLineCodeExecutor` 沙箱执行
- **gRPC**：`GrpcWorkerAgentRuntime` 分布式 Agent 部署
- **Azure**：深度 Azure 生态集成（Azure OpenAI、Azure AI Foundry、Azure Container Apps）
- **Web UI**：FastAPI、ChainLit、Streamlit 集成示例
- **Semantic Kernel**：通过 SK 适配器接入整个 SK 生态

### LangGraph

- **LangChain 工具生态**：直接使用 LangChain 的 1000+ 工具集成
- **MCP**：原生 MCP 协议支持
- **A2A**：Agent-to-Agent 协议支持
- **RemoteGraph**：Agent 间远程调用
- **LangSmith**：追踪、评估、监控
- **Agent Server**：RESTful API 部署
- **Streaming**：支持可恢复的流式传输
- **BaseStore**：通用存储接口，支持语义搜索

### 对比

| 集成维度 | AutoGen | LangGraph |
|---------|---------|-----------|
| 工具生态规模 | 中（Extensions 包 + MCP） | 大（LangChain 1000+ 工具） |
| 微软生态 | 深度集成（Azure 全家桶） | 无特殊集成 |
| 开放协议 | MCP | MCP + A2A |
| 企业追踪 | OpenTelemetry | LangSmith |
| Agent 互调 | gRPC 分布式运行时 | RemoteGraph |

---

## 8. 记忆/知识库

### AutoGen

**状态持久化**：
- `save_state()` / `load_state()` 方法序列化 Agent 和 Team 状态
- 状态为 Python 字典，可直接 JSON 序列化到磁盘/数据库
- Agent 状态包含 `llm_messages`（完整对话历史）
- Team 状态包含所有 Agent 状态 + `message_thread` + 轮次信息

**记忆系统**（Memory Protocol）：
| 类型 | 后端 | 特点 |
|------|------|------|
| ListMemory | 内存列表 | 时序排列，简单直接 |
| ChromaDBVectorMemory | ChromaDB | 向量相似度搜索，支持持久化 |
| RedisMemory | Redis | Redis 向量数据库后端 |
| Mem0Memory | Mem0.ai | 云端/本地，统一跨 Agent 记忆 |

**RAG 支持**：
- `SimpleDocumentIndexer` 文档索引器
- 支持 URL/本地文件加载 -> HTML 解析 -> 分块 -> 向量存储
- 通过 Memory 协议自动注入 Agent 上下文

### LangGraph

**短期记忆**：
- 线程作用域，通过 State 管理
- `add_messages` reducer 处理消息 ID 追踪和覆盖
- `MessagesState` 预置状态提供标准消息管理
- 挑战：长历史可能超出 LLM 上下文窗口

**长期记忆**：
- 跨线程共享，自定义 namespace 作用域
- 三种认知类型：语义记忆（事实）、情节记忆（经验）、程序记忆（规则）
- `BaseStore` 接口，支持 `put`/`get`/`search`
- 支持向量相似度搜索和内容过滤
- 两种写入模式：热路径（实时）和后台（异步）

**Checkpointing**：
- 编译时配置 Checkpointer
- 每次图调用或步骤完成时自动持久化
- 支持图拓扑变更迁移、状态键增删
- 内存和数据库后端可选

### 对比

| 能力 | AutoGen | LangGraph |
|------|---------|-----------|
| 状态持久化 | 手动序列化（dict -> JSON） | 内建 Checkpointer，自动化 |
| 向量记忆 | ChromaDB / Redis / Mem0 | BaseStore + 向量搜索 |
| RAG | 内建 SimpleDocumentIndexer | 依赖 LangChain RAG 组件 |
| 跨会话记忆 | Mem0Memory 支持 | 长期记忆 + namespace |
| 故障恢复 | 需手动实现 | Checkpoint 自动恢复 |
| 记忆结构化 | MemoryContent (content + metadata) | Profile 或 Collection 模式 |

---

## 9. 扩展性/插件系统

### AutoGen

**组件模型**：
- `autogen-ext` 包提供官方扩展
- 开发者可创建和发布自定义组件
- 组件序列化：`dump_component()` / `load_component()`

**自定义 Agent**：
- 继承 `BaseChatAgent` 实现 `on_messages()` 和 `on_reset()` 方法
- 覆盖 `save_state()` / `load_state()` 实现自定义持久化

**工具定义**：
- Python async 函数 + docstring 即可定义工具
- MCP 服务器集成：`mcp_server_tools()` 函数

**社区生态**：
- AutoGen Studio Gallery 组件中心
- GitHub 社区贡献指南

### LangGraph

**节点扩展**：
- 任何 Python 函数皆可为节点
- 函数签名：`(state, config?, runtime?)` -> state updates
- 自动转换为 `RunnableLambda` 支持批处理和异步

**工具集成**：
- LangChain 工具协议
- MCP 协议原生支持
- 自定义 Python 函数

**子图**：
- 子图可作为节点嵌入
- 支持状态映射（父子图状态转换）
- `Command(graph=Command.PARENT)` 跨图导航

**中间件**：
- Agent Server 支持自定义路由、中间件、生命周期钩子

### 对比

| 扩展能力 | AutoGen | LangGraph |
|---------|---------|-----------|
| 自定义 Agent | 继承 BaseChatAgent | 编写节点函数 |
| 工具扩展 | async 函数 + MCP | LangChain 工具 + MCP |
| 图组合 | GraphFlow (实验性) | 子图嵌套 (成熟) |
| 序列化 | dump_component / load_component | JSON 状态 + Checkpointer |
| 社区市场 | Studio Gallery | LangChain Hub |

---

## 10. 部署模式

### AutoGen

| 模式 | 机制 | 适用场景 |
|------|------|---------|
| 本地执行 | pip install + Python 脚本 | 开发/测试 |
| AutoGen Studio | Web UI 本地服务 | 原型设计 |
| Docker 容器 | DockerCommandLineCodeExecutor | 代码执行沙箱 |
| 分布式 | GrpcWorkerAgentRuntime | 跨节点 Agent 部署 |
| 多语言 | Python + .NET 互操作 | 异构环境 |

**特点**：
- gRPC 运行时支持从本地无缝迁移到分布式
- .NET SDK 支持，可在 C# 生态中部署
- Azure Container Apps 动态会话支持

### LangGraph

| 模式 | 机制 | 适用场景 |
|------|------|---------|
| 本地执行 | pip install + Python 脚本 | 开发/测试 |
| Cloud | Git 仓库 -> 全托管部署 | 快速上线 |
| Hybrid | Docker 镜像 + LangSmith 控制面 | 数据合规 |
| Self-hosted | 独立服务器，无控制面 | 完全自控 |
| Agent Server | RESTful API 服务 | 微服务集成 |

**特点**：
- 持久执行引擎：自动 checkpoint，故障自动恢复
- 后台运行：非阻塞执行 + 生命周期管理
- Cron 调度：定时周期性 Agent 执行
- 可恢复流式传输：断连后重连续传
- 水平扩展：生产部署支持水平缩放
- Double-texting 处理：并发输入不会导致数据竞争

### 对比

| 部署能力 | AutoGen | LangGraph |
|---------|---------|-----------|
| 托管平台 | 无（需自建或用 Azure） | LangSmith Agent Server |
| 分布式 | gRPC 运行时 | Agent Server + RemoteGraph |
| 容器化 | Docker 支持 | Docker + 全托管选项 |
| 多语言 | Python + .NET | Python + JS/TS |
| 故障恢复 | 无内建 | Checkpoint 自动恢复 |
| 定时任务 | 无内建 | Cron 支持 |
| 流式传输 | run_stream() | 可恢复流式传输 |

---

## 11. 开源与定价

### AutoGen

- **开源协议**：代码 MIT，文档 CC BY 4.0
- **完全免费**：没有商业版或付费层级
- **微软支持**：微软研究院维护，Azure 生态紧密集成
- **商业化路径**：通过 Azure 云服务间接商业化

### LangGraph

- **开源协议**：MIT（LangGraph 核心）
- **定价层级**：

| 层级 | 费用 | 座位 | Agent Builder | 部署 |
|------|------|------|--------------|------|
| Developer | 免费 | 1 | 1 Agent, 50 runs/月 | 不可用 |
| Plus | $39/座位/月 | 无限 | 无限 Agent, 500 runs/月 | 1 免费 dev 部署 |
| Enterprise | 定制 | 定制 | 定制 | Cloud/Hybrid/Self-hosted |
| Startup | 折扣 | - | 有信用额度 | - |

**追加费用**：
- 超额追踪：$0.50/千条基础追踪
- 额外 Agent Builder 运行：$0.05/次
- 额外部署运行：$0.005/次
- Dev 部署时间：$0.0007/分钟
- 生产部署时间：$0.0036/分钟
- LLM 费用由模型提供商另收

### 对 ClawForce 的启示

- AutoGen 无直接付费成本，但生产部署需自建基础设施
- LangGraph Platform 提供即买即用的企业特性，但有持续运营成本
- 两者核心引擎均为 MIT，可自由商业化使用

---

## 12. Human-in-the-loop

### AutoGen

**运行中交互**：
- `UserProxyAgent`：作为人类代理参与团队
  - 通过 `input_func` 参数自定义输入来源（控制台、WebSocket 等）
  - 在 RoundRobinGroupChat 中按顺序被调用
  - 在 SelectorGroupChat 中由选择器决定何时调用
  - **限制**：阻塞执行，不可序列化，不推荐用于长时间交互

**运行间交互**：
- `max_turns=1`：每次 Agent 响应后暂停，人类提供反馈后继续
- `HandoffTermination(target="user")`：Agent 主动将控制权移交给用户
- 状态持久化 + 异步恢复：适合持久化会话场景

**Magentic-One 审批**：
- 代码执行审批函数
- 安全警告和人工监控建议

### LangGraph

**interrupt() 函数**：
- 核心机制：在节点代码任意位置调用 `interrupt(payload)` 暂停执行
- 通过抛出异常实现暂停，自动触发 Checkpoint 持久化
- 接受任意 JSON 序列化值作为载荷，通过 `__interrupt__` 字段传递给调用者
- 恢复：`graph.invoke(Command(resume=value), config=config)` 使用相同 thread_id

**关键特性**：
- **审批模式**：interrupt 载荷描述待审批操作，resume 值携带审批决策
- **状态审查和编辑**：人类可检查和修改中间状态
- **工具内 interrupt**：interrupt 可嵌入工具函数，审批逻辑跨图复用
- **并行 interrupt**：Fan-out 产生多个同时 interrupt，通过 interrupt ID 映射 resume 值
- **输入验证循环**：循环中多次 interrupt 实现迭代验证
- **静态断点**：`interrupt_before` / `interrupt_after` 用于调试（不推荐用于 HITL）

**重要约束**：
- 不可在裸 try/except 中包裹（interrupt 使用异常机制）
- interrupt 顺序必须确定性（基于索引匹配）
- 仅支持 JSON 序列化载荷
- interrupt 前的副作用必须幂等（恢复时节点从头重新执行）

### 对比

| HITL 能力 | AutoGen | LangGraph |
|----------|---------|-----------|
| 核心机制 | UserProxyAgent + HandoffTermination | interrupt() 函数 |
| 灵活度 | 预定义交互点 | 任意代码位置 |
| 持久化 | 需手动 save/load | 自动 Checkpoint |
| 并行审批 | 不支持 | 支持（interrupt ID 映射） |
| 嵌套审批 | 不支持 | 支持（工具内 interrupt） |
| 状态编辑 | 不原生支持 | 原生支持 |
| 流式传输 | run_stream() | 可恢复流式 + interrupt 检测 |
| 异步恢复 | HandoffTermination + 状态持久化 | Command(resume) + thread_id |

---

## 综合评估与 ClawForce 建议

### 各维度优势归属

| 维度 | 胜出方 | 理由 |
|------|--------|------|
| 1. 架构模式 | 平手 | AutoGen 分层清晰，LangGraph 图模型灵活 |
| 2. 多Agent协作 | **AutoGen** | 5种预设模式 + Magentic-One，开箱即用 |
| 3. 工作流引擎 | **LangGraph** | 核心产品，持久化+子图+故障恢复 |
| 4. 权限RBAC | **LangGraph** | Enterprise 平台提供 SSO+RBAC |
| 5. 非技术UX | **AutoGen** | Studio 拖拽式更友好 |
| 6. LLM 支持 | 平手 | 都支持主流模型，路径不同 |
| 7. 集成生态 | **LangGraph** | LangChain 1000+ 工具集成 |
| 8. 记忆/知识库 | **LangGraph** | Checkpoint 自动化 + 长期记忆系统 |
| 9. 扩展性 | 平手 | 都支持自定义扩展，方式不同 |
| 10. 部署模式 | **LangGraph** | 托管平台 + 多种部署选项 + 故障恢复 |
| 11. 开源定价 | **AutoGen** | 完全免费，无付费层级 |
| 12. HITL | **LangGraph** | interrupt() 更灵活，支持并行审批和状态编辑 |

### ClawForce 平台建设建议

**推荐策略：吸收两者优势，构建差异化平台**

1. **编排引擎**：参考 LangGraph 的 StateGraph + Checkpoint 模式，这是构建可靠企业级工作流的基础。持久化执行和故障恢复是企业场景的刚需。

2. **Agent 协作**：参考 AutoGen 的多种 Team 模式（尤其是 SelectorGroupChat 和 Swarm），提供开箱即用的协作模式，降低开发者门槛。Magentic-One 的 Orchestrator 双循环机制值得借鉴。

3. **Human-in-the-loop**：采用 LangGraph 的 interrupt() 模式，在任意节点支持人工介入、审批和状态编辑。这对企业合规和风控至关重要。

4. **低代码体验**：参考 AutoGen Studio 的可视化构建理念，但需要做到生产就绪（AutoGen Studio 明确不是）。

5. **权限系统**：两者都不提供完善的 RBAC，这是 ClawForce 的差异化机会。企业级 AI 员工平台必须有完善的角色权限、审计日志、数据隔离。

6. **记忆架构**：结合 LangGraph 的三层记忆（短期/长期/跨会话）和 AutoGen 的 Memory Protocol，构建企业级知识管理。

7. **部署灵活性**：提供与 LangGraph Platform 类似的 Cloud/Hybrid/Self-hosted 选项，但无需绑定特定平台。

8. **定价策略**：AutoGen 完全免费但无企业支持；LangGraph 有明确的付费层级。ClawForce 可考虑开源核心 + 企业增值服务模式。
