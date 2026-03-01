<!-- devpace-start -->
# DevPace 集成

本项目使用 devpace 进行开发节奏管理。

## 项目信息

- **项目名称**：ClawForce
- **项目定位**：Your AI Workforce, Unleashed
- **项目描述**：基于 OpenClaw 的 AI 员工平台 — 让企业管理者像管理真实团队一样创建、配置和管理 AI 员工

## DevPace 核心概念

- **CR (Change Request)**：变更请求，devpace 的基本工作单元，存储在 `.devpace/backlog/` 目录
- **质量门（Gate）**：CR 状态转换的检查点，确保质量标准
- **价值功能树**：从业务结果（BR）→ 产品功能（PF）→ 变更请求（CR）的层次结构

## 常用命令

- `/pace-status`：查看项目进度和当前工作
- `/pace-dev`：开始或继续实现 CR
- `/pace-change`：管理需求变更（添加、暂停、恢复、调整优先级）
- `/pace-review`：执行质量门检查
- `/pace-retro`：迭代回顾和度量分析

## 工作流程

1. **自然语言启动**：直接说"帮我实现/修复/添加 XXX"，devpace 会自动创建 CR
2. **质量门检查**：CR 进入 `in_review` 状态时自动执行 `.devpace/rules/checks.md` 中的检查项
3. **状态追踪**：所有工作状态记录在 `.devpace/state.md`

## 配置文件位置

- 项目状态：`.devpace/state.md`
- 项目规划：`.devpace/project.md`
- 工作流规则：`.devpace/rules/workflow.md`
- 质量检查：`.devpace/rules/checks.md`
- CR 存储：`.devpace/backlog/CR-*.md`

---

**注意**：`.devpace/` 目录内容由 devpace 管理，请勿手动编辑（除非你知道自己在做什么）。
<!-- devpace-end -->

# IaC 铁律（infra/）

本项目 `infra/` 是基础设施即代码项目。**所有修复必须持久化到 IaC 中**，禁止仅做临时快速修复。

## 核心原则

1. **IaC 是唯一真实源**：任何配置变更必须体现在 CDK 代码中，`cdk destroy && cdk deploy` 必须能完整还原工作状态
2. **禁止仅做 SSH 临时修复**：SSH 修改仅用于紧急止血 + 验证方案，验证通过后必须立即写入 IaC 代码
3. **单次写入原则**：配置文件只写一次且包含完整内容，禁止多步骤分步修补（写 → 补丁 → 再补丁），每次补丁都是 bug 来源

## EC2 UserData 约束

- **UserData 只在首次启动执行**：CloudFormation 更新 UserData 不会触发 instance 重建，必须 destroy+deploy 才能生效
- **配置动态生成**：`openclaw.json` 等运行时配置由 TypeScript 在 CDK synth 时生成（`buildOpenClawConfig()`），不使用静态资产文件
- **执行顺序**：所有配置写入必须在 `docker compose up` 之前完成，禁止启动后再 `docker compose restart`

## OpenClaw 配置约束

- **模型 ID 必须用 Inference Profile 格式**：`us.anthropic.claude-sonnet-4-6`（带 `us.` 前缀），不能用 base model ID `anthropic.claude-sonnet-4-6`
- **Bedrock Provider 必须配置**：`openclaw.json` 必须包含 `models.providers.amazon-bedrock`（`api: bedrock-converse-stream`, `auth: aws-sdk`, `baseUrl`, `models` 数组）
- **模型配置在 openclaw.json**：通过 `agents.defaults.model.primary` 设置，不通过 `OPENCLAW_MODEL` 环境变量
- **CORS allowedOrigins 不支持通配符**：OpenClaw 不接受 `"*"`，必须注入具体的 ALB DNS origin
- **OpenClaw CLI 会重写 openclaw.json**：`openclaw models set` 等命令会覆盖整个配置文件，因此初始配置必须完整

## AWS IAM / Bedrock 约束

- **跨区域 Inference Profile 路由不可预测**：`us.` 前缀的模型会路由到任意 US 区域（us-east-1/2, us-west-2 等）
- **IAM foundation-model ARN 必须用 `*` 区域**：`arn:aws:bedrock:*::foundation-model/*`，不能硬编码单个区域
- **IMDSv2 hop limit = 2**：Docker 容器访问 IMDS 需要 hop limit ≥ 2
- **IMDS 查询必须用 v2 token**：先 PUT 获取 token，再 GET 带 token header，不能用 v1 裸 curl

# Git 规则

- `git push` 命令必须加 `--no-verify` 参数（企业环境 Code Defender pre-push hook 会拦截外部仓库推送）
