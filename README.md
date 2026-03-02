# ClawForce

**"Your AI Workforce, Unleashed"**

基于 OpenClaw 的 AI 员工平台 — 让企业管理者像管理真实团队一样创建、配置和管理 AI 员工。

## 当前部署

| 项 | 值 |
|----|-----|
| Region | us-west-2（部署）/ us-east-1（Bedrock） |
| Stack | ClawForceStack |
| 模型 | Claude Sonnet 4.6 via Bedrock（可切换 Opus 4.6 / Haiku 4.5） |
| 入口 | ALB → EC2:18789（Gateway + Control UI） |

## 目录结构

```
claw-force/
├── infra/               # AWS CDK 基础设施（TypeScript）
│   ├── lib/constructs/  #   L3 Construct（networking/compute/alb/waf/iam/monitoring/efs）
│   ├── lib/stacks/      #   ClawForceStack（单 Stack 组合所有 Construct）
│   ├── assets/          #   docker-compose.yml（openclaw.json 由 TypeScript 动态生成）
│   └── test/            #   Jest + CDK Assertions + CDK Nag
├── openclaw-fork/       # OpenClaw 上游 fork（Node.js/TypeScript）
├── research/            # 调研报告（竞品分析、技术评估）
├── docs/                # 项目文档（PRD、规划、IaC 标准）
└── scripts/             # 工具脚本（PoC 验证、AWS 部署辅助）
```

**关系**：`infra/` 的 UserData 从 `openclaw-fork/` 源码 build Docker 镜像并部署到 EC2，通过 ALB + WAF 暴露服务。

<!-- AUTO-GENERATED:commands-start -->
## 常用命令

### infra/（CDK 基础设施）

| 命令 | 说明 |
|------|------|
| `pnpm test` | 运行所有测试（Jest + CDK Assertions + CDK Nag） |
| `pnpm test:coverage` | 测试 + 覆盖率报告 |
| `pnpm lint` | ESLint 代码检查 |
| `pnpm lint:fix` | ESLint 自动修复 |
| `pnpm format:check` | Prettier 格式化检查 |
| `pnpm format` | Prettier 格式化代码 |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm build` | 编译 TypeScript |
| `pnpm cdk synth` | 合成 CloudFormation 模板 |
| `pnpm cdk diff` | 查看基础设施变更 |
| `pnpm cdk deploy` | 部署到 AWS |
| `pnpm cdk destroy` | 销毁 Stack |
| `pnpm validate` | 验证 Bedrock 模型配置 |

### openclaw-fork/（OpenClaw Gateway）

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 生产构建 |
| `pnpm test` | 运行测试（Vitest） |
| `pnpm test:coverage` | 测试 + V8 覆盖率 |
| `pnpm check` | format + typecheck + lint 全部检查 |
| `pnpm start` | 启动 OpenClaw Gateway |
| `pnpm gateway:dev` | 启动开发模式 Gateway（跳过 channels） |
<!-- AUTO-GENERATED:commands-end -->

## 快速开始

```bash
# 1. 安装 infra 依赖
cd infra && pnpm install

# 2. 运行测试确认环境
pnpm test

# 3. 合成并查看变更
pnpm cdk synth && pnpm cdk diff

# 4. 部署
pnpm cdk deploy --require-approval never
```

## 核心概念

- **AI Employee**: 扩展自 OpenClaw Agent，具备岗位角色、技能集、工作记忆
- **AI Dev Team (MVP)**: PM + Developer + QA 协作完成软件开发任务
- **IaC 铁律**: 所有修复必须持久化到 CDK 代码中，`cdk destroy && cdk deploy` 必须能完整还原

## 关键资源

- [调研设计方案](./docs/plan.md) - 完整项目规划
- [IaC 标准体系](./docs/production-grade-iac-standards.md) - 生产级基础设施标准
- [开发指南](./docs/CONTRIBUTING.md) - 开发环境搭建与工作流
- [运维手册](./docs/RUNBOOK.md) - 部署、排障与回滚
