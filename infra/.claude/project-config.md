# 项目配置 - ClawForce Infrastructure

> **职责**: ClawForce 项目的特定配置，包括 Stack 列表、环境配置、Construct 列表和成本标签。

> **定位**: 本文件是 CLAUDE.md 的补充，包含**项目特定的业务配置**。
> **原则**: 通用规范放 `rules/`，项目特定信息放此处。
> 架构规范详见 [rules/architecture.md](rules/architecture.md)

---

## 项目信息

| 配置项 | 值 |
|--------|-----|
| **项目名称** | clawforce-infra |
| **项目描述** | ClawForce - 基于 OpenClaw 的 AI 员工平台基础设施 |
| **架构模式** | CDK Construct 分层 (L1 → L2 → L3) |
| **技术栈版本** | 见 [tech-stack.md](rules/tech-stack.md) |
| **源码根路径** | `lib` |

---

## Stack 列表

Stack 设计规范见 [architecture.md §2.1](rules/architecture.md#21-stack-职责)

**本项目 Stack**:

| Stack | 依赖 |
|-------|------|
| `ClawForceStack` | - (单一 Stack，包含所有 Constructs) |

---

## 环境配置

> **设计原则**: 使用 CDK Context 管理不同环境的配置。

### 环境定义

| 环境 | AWS 账户 | Region | 用途 |
|------|---------|--------|------|
| `dev` | 123456789012 | ap-northeast-1 | 开发测试 |
| `staging` | 123456789013 | ap-northeast-1 | 预发布验证 |
| `prod` | 123456789014 | ap-northeast-1 | 生产环境 |

### CDK Context 配置

详细配置结构见 [deployment.md §1.1](rules/deployment.md#11-cdk-context)

**本项目配置值**: 见上方环境表格

---

## Construct 列表

> **位置约定**: 自定义 Construct 放在 `lib/constructs/` 下。

| Construct | 职责 | 组合资源 |
|-----------|------|---------|
| `ClawForceNetworking` | 网络安全组 | VPC (默认), Security Group |
| `ClawForceIam` | IAM 角色 | IAM Role, Instance Profile |
| `ClawForceCompute` | EC2 实例 | EC2 Instance, EBS Volume, UserData |
| `ClawForceAlb` | 负载均衡 | ALB, Target Groups, Listeners |
| `ClawForceWaf` | WAF 防护 | WebACL, Rules |
| `ClawForceMonitoring` | 监控告警 | CloudWatch LogGroups, Alarms |

---

## 命名约定

命名规范见 [CLAUDE.md §命名规范](../CLAUDE.md#命名规范)

**本项目前缀**: `clawforce`
**Stack 命名**: `ClawForceStack`

---

## 架构合规规则

> **详细规则**: 见 [rules/security.md](rules/security.md) 和 [rules/architecture.md](rules/architecture.md)

### CDK Nag 检查

```typescript
// bin/app.ts
import { Aspects } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';

// 应用 AWS Solutions 检查
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
```

### 违规检测

| 违规类型 | 规则 | 严重级别 |
|---------|------|---------|
| 公开 S3 Bucket | AwsSolutions-S3 | 🔴 阻止 |
| 过宽 IAM 权限 | AwsSolutions-IAM4 | 🔴 阻止 |
| 未加密存储 | AwsSolutions-RDS10 | 🟡 警告 |
| 缺少访问日志 | AwsSolutions-ELB2 | 🟡 警告 |

---

## 成本标签

> **原则**: 所有资源必须包含成本标签用于成本分配。

```typescript
// 必须的标签
const requiredTags = {
  Project: 'clawforce',
  Environment: env,
  ManagedBy: 'cdk',
  CostCenter: 'clawforce',
};

// 应用标签
Tags.of(app).add('Project', 'clawforce');
Tags.of(app).add('Environment', env);
```

---

## PR Review 检查清单

完整检查清单见 [rules/checklist.md](rules/checklist.md)
