# ClawForce

基于 OpenClaw 的 AI 员工平台 — 让企业管理者像管理真实团队一样创建、配置和管理 AI 员工。

## 项目架构

```
claw-force/
├── infra/           # AWS CDK 基础设施（TypeScript）— 详见 infra/.claude/CLAUDE.md
│   ├── lib/constructs/  # L3 Construct（networking/compute/alb/waf/iam/monitoring/efs）
│   ├── lib/stacks/      # ClawForceStack（单 Stack 组合所有 Construct）
│   ├── assets/          # docker-compose.yml（openclaw.json 由 TypeScript 动态生成）
│   └── test/            # Jest + CDK Assertions + CDK Nag
├── openclaw-fork/   # OpenClaw 上游 fork（Node.js/TypeScript）— 详见 openclaw-fork/CLAUDE.md
└── .devpace/        # DevPace 开发节奏管理（CR/PF/BR 价值链）
```

**关系**：`infra/` 的 UserData 从源码 build OpenClaw Docker 镜像并部署到 EC2，通过 ALB + WAF 暴露服务。

## 当前部署

| 项 | 值 |
|----|-----|
| Region | us-west-2（部署）/ us-east-1（Bedrock） |
| Stack | ClawForceStack |
| 模型 | Claude Sonnet 4.6 via Bedrock（可切换 Opus 4.6 / Haiku 4.5） |
| 入口 | ALB → EC2:18789（Gateway + Control UI） |

## 常用命令

```bash
# infra/ 目录下执行
pnpm test                    # 113 tests（Jest + CDK Assertions + Nag）
pnpm lint && pnpm format:check && pnpm typecheck  # 代码质量三件套
pnpm cdk synth               # 合成 CloudFormation
pnpm cdk diff                # 查看变更
pnpm cdk deploy --require-approval never  # 部署
pnpm cdk destroy --force     # 销毁（UserData 变更必须 destroy+deploy）
```

<!-- devpace-start -->
## DevPace

`/pace-dev` 开始实现 | `/pace-review` 质量审核 | `/pace-status` 查看进度 | `/pace-next` 下一步建议

状态：`.devpace/state.md` | CR 存储：`.devpace/backlog/CR-*.md` | 规则：`.devpace/rules/`
<!-- devpace-end -->

# IaC 铁律（infra/）

**所有修复必须持久化到 IaC 中**。`cdk destroy && cdk deploy` 必须能完整还原工作状态。禁止仅做 SSH 临时修复。

## 配置原则

- **单次写入**：配置文件只写一次且包含完整内容，禁止分步修补（写 → 补丁 → 再补丁）
- **动态生成**：`openclaw.json` 由 TypeScript 在 synth 时生成（`buildOpenClawConfig()`），不使用静态资产文件
- **执行顺序**：所有配置写入必须在 `docker compose up` 之前完成
- **UserData 只在首次启动执行**：CloudFormation 更新 UserData 不触发 instance 重建，必须 destroy+deploy

## OpenClaw 约束

| 约束 | 正确 | 错误 |
|------|------|------|
| 模型 ID | `us.anthropic.claude-sonnet-4-6`（Inference Profile） | `anthropic.claude-sonnet-4-6`（base ID） |
| 模型配置 | `openclaw.json` 的 `agents.defaults.model.primary` | `OPENCLAW_MODEL` 环境变量 |
| Bedrock Provider | `api: bedrock-converse-stream` + `auth: aws-sdk` + `baseUrl` + `models[]` | 仅 `region` 字段 |
| CORS | 注入具体 ALB DNS origin | `allowedOrigins: ["*"]`（不支持通配符） |
| 配置完整性 | 初始写入包含所有字段 | 依赖 `openclaw models set` CLI 补全（会重写整个文件） |

## AWS 约束

| 约束 | 规则 |
|------|------|
| 跨区域 Inference Profile | `us.` 前缀路由到任意 US 区域，IAM 必须用 `arn:aws:bedrock:*::foundation-model/*` |
| IMDSv2 | hop limit ≥ 2（Docker 容器）；必须先 PUT 获取 token 再 GET |
| EFS 数据持久化 | EFS 用 `RETAIN` 策略；首次部署后将 EFS ID 保存到 `cdk.json` 的 `efsFileSystemId` |

# Git 与分支策略

## 分支模型：GitHub Flow + Release Branches

```
main (protected)              ← 始终可部署，仅接受 PR
  ├── feat/session-persist    ← 功能分支
  ├── fix/cors-drift          ← 修复分支
  └── release/v0.3.0          ← 发布分支（稳定后打 tag）
```

## 分支命名

| 前缀 | 用途 | 示例 |
|------|------|------|
| `feat/` | 新功能 | `feat/efs-persistence` |
| `fix/` | Bug 修复 | `fix/cors-drift` |
| `hotfix/` | 紧急线上修复 | `hotfix/bedrock-auth` |
| `refactor/` | 重构 | `refactor/userdata-phases` |
| `docs/` | 文档 | `docs/contributing` |
| `chore/` | 构建/CI/依赖 | `chore/ci-workflow` |
| `release/` | 发布准备 | `release/v0.3.0` |

## 规则

- **所有变更通过 PR** 合并到 main（禁止直接 push）
- **Squash merge** 保持 main 历史线性
- **Conventional Commits**：`type(scope): description`
- **CI 必须通过**：typecheck + lint + format + test + cdk synth
- **`git push` 加 `--no-verify`**（Code Defender pre-push hook 拦截外部仓库）

## 发布流程

```
main 功能积累 → git checkout -b release/vX.Y.Z
→ 仅接受 cherry-pick bug fix → 稳定后 git tag vX.Y.Z
→ gh release create → 删除 release 分支
```

## DevPace 集成

| DevPace 事件 | Git 操作 |
|-------------|---------|
| CR created | `git checkout -b feat/xxx` 或 `fix/xxx` |
| CR in_review | `gh pr create` |
| CR merged | Squash merge → main |
| REL closed | `git tag vX.Y.Z` + `gh release create` |
