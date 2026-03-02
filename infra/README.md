# ClawForce Infrastructure

AWS CDK TypeScript 基础设施项目，为 OpenClaw Gateway 提供自动化部署。

## 技术栈

- **AWS CDK** >=2.130.0（TypeScript）
- **测试**: Jest + CDK Assertions + CDK Nag（AwsSolutionsChecks）
- **包管理**: pnpm（禁止 npm/yarn）
- **代码质量**: ESLint + Prettier

## 架构

```
ClawForceStack
├── NetworkingConstruct    # VPC、子网、NAT Gateway
├── ComputeConstruct       # EC2 实例、UserData
├── AlbConstruct           # Application Load Balancer、CORS
├── WafConstruct           # WAF WebACL、速率限制
├── IamConstruct           # IAM Role、Bedrock 访问策略
├── MonitoringConstruct    # CloudWatch 日志、告警
└── EfsConstruct           # EFS 持久存储
```

<!-- AUTO-GENERATED:scripts-start -->
## 可用命令

| 命令 | 说明 |
|------|------|
| `pnpm build` | 编译 TypeScript |
| `pnpm watch` | 监听模式编译 |
| `pnpm test` | 运行 Jest 测试 |
| `pnpm test:coverage` | 测试 + 覆盖率报告 |
| `pnpm lint` | ESLint 检查 `lib/` `bin/` `test/` |
| `pnpm lint:fix` | ESLint 自动修复 |
| `pnpm format:check` | Prettier 格式化检查 |
| `pnpm format` | Prettier 格式化代码 |
| `pnpm typecheck` | TypeScript 类型检查（`tsc --noEmit`） |
| `pnpm validate` | 验证 Bedrock 模型可用性 |
| `pnpm cdk synth` | 合成 CloudFormation 模板 |
| `pnpm cdk diff` | 查看基础设施变更 |
| `pnpm cdk deploy` | 部署 Stack |
| `pnpm cdk destroy` | 销毁 Stack |
| `pnpm cdk list` | 列出所有 Stack |
| `pnpm cdk bootstrap` | Bootstrap CDK（每个 AWS 账户/Region 执行一次） |
<!-- AUTO-GENERATED:scripts-end -->

## 快速开始

```bash
pnpm install                 # 安装依赖
pnpm cdk bootstrap           # 首次使用 CDK（每个 AWS 账户/Region 一次）
pnpm test                    # 确保测试通过
pnpm cdk synth && pnpm cdk diff  # 合成并查看变更
pnpm cdk deploy --require-approval never  # 部署
```

## 预提交验证

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm cdk synth && pnpm test
```

## 关键约束

- **UserData 只在首次启动执行**: CloudFormation 更新 UserData 不触发 instance 重建，必须 `destroy + deploy`
- **openclaw.json 动态生成**: 由 TypeScript `buildOpenClawConfig()` 在 synth 时生成，不使用静态资产文件
- **模型 ID 格式**: 必须使用 Inference Profile 格式 `us.anthropic.claude-sonnet-4-6`
- **IMDSv2**: hop limit >= 2（Docker 容器需要额外跳数）

## 详细规范

参见 `infra/.claude/CLAUDE.md` 和 `infra/.claude/rules/` 下的规范文档。
