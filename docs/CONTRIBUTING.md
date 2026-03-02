# 开发指南

## 前置条件

| 工具 | 最低版本 | 说明 |
|------|---------|------|
| Node.js | 22.12.0+ | OpenClaw 运行时要求 |
| pnpm | 10.x | 包管理器（禁止 npm/yarn） |
| AWS CLI | 2.x | CDK 部署和 AWS 操作 |
| AWS CDK CLI | 2.130.0+ | `pnpm exec cdk --version` |

## 环境搭建

### infra/（CDK 基础设施）

```bash
cd infra
pnpm install

# 验证环境
node -v && pnpm -v && pnpm exec tsc --version && pnpm exec cdk --version

# 运行测试确认一切正常
pnpm test
```

### openclaw-fork/（OpenClaw Gateway）

```bash
cd openclaw-fork
pnpm install

# 启动开发模式
pnpm dev

# 或仅启动 Gateway（跳过 channels）
pnpm gateway:dev
```

<!-- AUTO-GENERATED:env-start -->
## 环境变量

### infra 部署环境变量

通过 `docker-compose.yml` 注入到容器：

| 变量 | 必须 | 说明 | 示例 |
|------|:----:|------|------|
| `AWS_REGION` | 是 | AWS 区域（Bedrock API） | `us-west-2` |
| `AWS_DEFAULT_REGION` | 是 | 回退区域 | `us-west-2` |
| `OPENCLAW_GATEWAY_TOKEN` | 是 | Gateway 认证 token（`--bind lan` 模式必须） | `openssl rand -hex 32` |

### openclaw-fork 环境变量（`.env.example`）

| 变量 | 必须 | 说明 | 示例 |
|------|:----:|------|------|
| `OPENCLAW_GATEWAY_TOKEN` | 推荐 | Gateway 认证 token | 长随机字符串 |
| `OPENCLAW_GATEWAY_PASSWORD` | 否 | 替代 token 的密码认证 | 强密码 |
| `OPENAI_API_KEY` | 至少一个 | OpenAI API Key | `sk-...` |
| `ANTHROPIC_API_KEY` | 至少一个 | Anthropic API Key | `sk-ant-...` |
| `GEMINI_API_KEY` | 至少一个 | Google Gemini API Key | - |
| `TELEGRAM_BOT_TOKEN` | 否 | Telegram 频道 | `123456:ABCDEF...` |
| `DISCORD_BOT_TOKEN` | 否 | Discord 频道 | - |
| `SLACK_BOT_TOKEN` | 否 | Slack 频道 | `xoxb-...` |
| `SLACK_APP_TOKEN` | 否 | Slack App Token | `xapp-...` |

> 完整列表见 `openclaw-fork/.env.example`。模型配置位于 `openclaw.json`（由 CDK 动态生成），不通过环境变量设置。
<!-- AUTO-GENERATED:env-end -->

<!-- AUTO-GENERATED:scripts-start -->
## 可用脚本

### infra/

| 命令 | 说明 |
|------|------|
| `pnpm build` | 编译 TypeScript |
| `pnpm test` | 运行所有测试（113 tests） |
| `pnpm test:coverage` | 测试 + 覆盖率 |
| `pnpm lint` | ESLint 检查 |
| `pnpm format:check` | Prettier 格式化检查 |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm validate` | 验证 Bedrock 模型配置 |
| `pnpm cdk synth` | 合成 CloudFormation |
| `pnpm cdk diff` | 查看变更 |
| `pnpm cdk deploy` | 部署 |

### openclaw-fork/

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动开发模式 |
| `pnpm build` | 生产构建 |
| `pnpm test` | Vitest 单元测试 |
| `pnpm test:coverage` | 测试 + V8 覆盖率 |
| `pnpm check` | format + typecheck + lint |
| `pnpm start` | 启动 Gateway |
| `pnpm gateway:dev` | 开发模式 Gateway |
<!-- AUTO-GENERATED:scripts-end -->

## 测试

### infra 测试

```bash
cd infra

# 运行所有测试
pnpm test

# 带覆盖率
pnpm test:coverage

# 运行特定测试
pnpm test lib/constructs/networking.test.ts

# 更新快照（CDK 资源变更后）
npx jest --updateSnapshot
```

测试类型：
- **Fine-grained Assertions**: 验证具体资源属性（CDK Assertions）
- **Snapshot Tests**: 检测意外的 CloudFormation 变更
- **CDK Nag Compliance**: AWS Solutions 安全合规检查

### openclaw-fork 测试

```bash
cd openclaw-fork
pnpm test              # Vitest 单元测试
pnpm test:coverage     # V8 覆盖率
pnpm test:e2e          # 端到端测试
```

## 代码风格

### infra/
- ESLint + Prettier 强制执行
- 预提交验证: `pnpm lint && pnpm format:check && pnpm typecheck`
- Construct Props 使用 `readonly` 修饰
- 命名: `PascalCase` Construct 类，`kebab-case` 目录

### openclaw-fork/
- Oxlint + Oxfmt 强制执行
- 预提交验证: `pnpm check`
- 文件保持 <500 LOC
- 严格 TypeScript，禁止 `any`

## PR 提交流程

1. 创建 feature branch: `git checkout -b feature/xxx`
2. 编写测试 + 实现代码（TDD）
3. 运行预提交验证:
   ```bash
   # infra
   cd infra && pnpm lint && pnpm format:check && pnpm typecheck && pnpm cdk synth && pnpm test
   ```
4. 提交: 遵循 Conventional Commits 格式
5. Push: `git push --no-verify`（Code Defender pre-push hook 拦截外部仓库）

## 部署与运维

### 标准部署

```bash
cd infra
aws sts get-caller-identity            # 确认 AWS 身份
pnpm cdk synth && pnpm cdk diff        # 合成并检查变更
pnpm test                              # 运行测试
pnpm cdk deploy --require-approval never
```

### UserData 变更（必须 destroy + deploy）

```bash
cd infra
pnpm cdk destroy --force
pnpm cdk deploy --require-approval never
```

> EFS 使用 RETAIN 策略，destroy 不会删除持久化数据。

### 回滚

```bash
# 标准回滚
pnpm cdk deploy --rollback

# 紧急回滚：回退代码 + 重新部署
git checkout <stable-commit>
cd infra && pnpm cdk deploy --require-approval never
```

### 常见故障排查

| 问题 | 排查方法 |
|------|---------|
| ALB Target unhealthy | `aws logs tail /clawforce/openclaw --since 30m` |
| Bedrock 调用失败 | `cd infra && pnpm validate`; 检查 IAM `arn:aws:bedrock:*` |
| CDK Deploy 失败 | `pnpm cdk synth 2>&1 \| tail -20`; 检查 CDK Nag 违规 |
| EFS 挂载超时 | 检查安全组是否允许 NFS port 2049 |
| CORS 错误 | 确认 `openclaw.json` CORS origin 与 ALB DNS 匹配 |
