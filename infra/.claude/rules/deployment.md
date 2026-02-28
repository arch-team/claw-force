# 部署规范 (Deployment Standards)

> **职责**: 定义部署执行规范，包括环境矩阵、CI/CD Pipeline、部署流程和蓝绿部署策略。

> Claude 执行部署相关操作时优先查阅此文档

> **职责边界**: 本文档关注**部署执行**（环境矩阵、CI/CD、部署流程）。环境配置的**架构设计**（CDK Context 结构）详见 [architecture.md §4](architecture.md#4-环境配置)

---

## 0. 速查卡片

### 部署命令

完整 CDK 命令见 [CLAUDE.md §CDK 命令](../CLAUDE.md#cdk-命令)

```bash
# 指定环境部署
pnpm cdk deploy --context env=prod --all

# 查看变更后部署
pnpm cdk diff && pnpm cdk deploy
```

### 环境矩阵

| 环境 | 用途 | 部署方式 | 审批 |
|------|------|---------|------|
| dev | 开发测试 | 手动 / CI | 无 |
| staging | 预发布 | CI/CD | 自动 |
| prod | 生产 | CI/CD | 手动审批 |

> **注意**: staging 环境暂不实现（v1.4 简化），当前仅 dev + prod 两套。待业务规模需要时再启用。

---

## 1. 环境配置

环境配置架构详见 [architecture.md §4](architecture.md#4-环境配置)

### RemovalPolicy 策略

| 环境 | S3/Logs | RDS |
|------|---------|-----|
| Dev | DESTROY | DESTROY |
| Staging (暂不实现) | DESTROY | SNAPSHOT |
| Prod | RETAIN | SNAPSHOT |

> 当前实现仅区分 dev/prod，参考 `lib/config/constants.ts` 的 `getRemovalPolicy()`

---

## 2. CI/CD Pipeline

### GitHub Actions (关键配置)

```yaml
# .github/workflows/cdk-deploy.yml
name: CDK Deploy

on:
  push:
    branches: [main]
    paths: ['infra/**']
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        options: [dev, prod]  # staging 暂不实现

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install && pnpm test:coverage
      - run: pnpm cdk synth --context env=${{ inputs.environment || 'dev' }}

  deploy-dev:
    needs: test
    environment: dev
    steps:
      - run: pnpm cdk deploy --all --context env=dev --require-approval never

  deploy-prod:
    needs: deploy-dev  # staging 暂不实现，prod 直接依赖 dev
    environment:
      name: prod  # 需要手动审批
    steps:
      - run: pnpm cdk deploy --all --context env=prod --require-approval never
```

### CDK Pipeline (AWS 原生)

```typescript
const pipeline = new CodePipeline(this, 'Pipeline', {
  synth: new ShellStep('Synth', {
    input: CodePipelineSource.gitHub('owner/repo', 'main'),
    commands: ['cd infra', 'pnpm install', 'pnpm test', 'pnpm cdk synth'],
  }),
});

// Prod 阶段需要手动审批
pipeline.addStage(prodStage, {
  pre: [new pipelines.ManualApprovalStep('Approve')],
});
```

---

## 3. 部署流程

### 手动部署

> ⚠️ **必须在 `infra/` 目录执行** CDK 命令，否则找不到 `cdk.json`
> ⚠️ **Prod 环境必须显式传 `--context env=prod`**，否则默认 dev

```bash
cd infra/                                                    # 必须切换到 infra/ 目录
echo $AWS_PROFILE                                            # 1. 确认环境
pnpm cdk synth --context env=dev && pnpm cdk diff           # 2. 合成并检查 (dev)
pnpm cdk synth --context env=prod && pnpm cdk diff          # 2. 合成并检查 (prod)
pnpm test                                                    # 3. 运行测试（含快照）
pnpm cdk deploy --all --context env=dev                     # 4. 部署 dev
pnpm cdk deploy ClawForceStack --context env=prod --require-approval never  # 4. 部署 prod
aws cloudformation describe-stacks --stack-name X           # 5. 验证
```

**快照更新（CDK 资源变更后必须执行）**:
```bash
npx jest --updateSnapshot   # 更新过期的 CDK 快照
```

### 部署顺序

NetworkStack → SecurityStack → DatabaseStack → ComputeStack → ApiStack → MonitoringStack

### 回滚策略

```bash
# 回滚到上一个版本
pnpm cdk deploy --all --context env=dev --rollback

# 紧急: 销毁并重建
pnpm cdk destroy ComputeStack-dev && pnpm cdk deploy ComputeStack-dev
```

---

## 4. 蓝绿部署 (ECS)

使用 CodeDeploy 进行蓝绿部署，支持金丝雀发布和自动回滚:

```typescript
new codedeploy.EcsDeploymentGroup(this, 'DeploymentGroup', {
  service: ecsService,
  blueGreenDeploymentConfig: {
    blueTargetGroup, greenTargetGroup, listener, testListener,
  },
  deploymentConfig: codedeploy.EcsDeploymentConfig.LINEAR_10PERCENT_EVERY_1MINUTES,
  autoRollback: { failedDeployment: true, stoppedDeployment: true },
});
```

---

## 5. 安全部署

安全规范详见 [security.md](security.md)

### 部署前检查

```bash
pnpm test test/compliance/  # CDK Nag 检查
git secrets --scan          # 敏感信息检查
pnpm audit                  # 依赖漏洞检查
```

---

## 相关文档

| 文档 | 说明 |
|------|------|
| [architecture.md](architecture.md) | Stack 依赖关系、环境配置 |
| [security.md](security.md) | 部署安全、IAM 权限 |
| [cost-optimization.md](cost-optimization.md) | 环境成本管理 |
