---
version: 1.0.0
last_updated: 2026-02-05
tech_stack_ref: rules/tech-stack.md
---

# CLAUDE.md - AWS CDK 基础设施项目规范

> **职责**: AWS CDK 基础设施项目的 Claude Code 入口规范，提供技术栈概览、开发命令和规范导航。

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **注意**: 通用规范（响应语言、项目概述）请参考 [根目录 CLAUDE.md](../../CLAUDE.md)

---

## 技术栈

> **详细版本要求**: 见 [rules/tech-stack.md](rules/tech-stack.md) (单一真实源)

**核心**: AWS CDK | TypeScript | Node.js

**测试**: Jest | CDK Assertions | CDK Nag

**工具**: pnpm (包管理) | ESLint | Prettier

---

## 环境设置

```bash
# 首次设置
pnpm install
pnpm cdk bootstrap  # 首次使用 CDK（每个 AWS 账户/Region 执行一次）

# 验证环境
node -v && pnpm -v && pnpm exec tsc --version && pnpm exec cdk --version
pnpm cdk synth       # 确保能成功合成
pnpm test            # 确保测试通过
```

---

## 开发命令

### CDK 命令

```bash
# 合成 CloudFormation 模板
pnpm cdk synth

# 查看变更 (diff)
pnpm cdk diff

# 部署到 AWS
pnpm cdk deploy

# 部署指定 Stack
pnpm cdk deploy <StackName>

# 部署所有 Stack
pnpm cdk deploy --all

# 销毁 Stack
pnpm cdk destroy <StackName>

# 列出所有 Stack
pnpm cdk list

# Bootstrap CDK (首次使用)
pnpm cdk bootstrap
```

### 代码质量

```bash
# 代码检查 (lint)
pnpm lint

# 代码检查并自动修复
pnpm lint --fix

# 格式化检查
pnpm format:check

# 格式化代码
pnpm format

# 类型检查
pnpm typecheck

# 一键运行所有检查
pnpm lint && pnpm format:check && pnpm typecheck
```

### 测试

```bash
# 运行所有测试
pnpm test

# 运行测试 + 覆盖率报告
pnpm test:coverage

# 监听模式
pnpm test:watch

# 运行特定测试文件
pnpm test lib/constructs/
```

---

## 核心原则

### Construct 设计原则

**核心原则**：分层抽象 + 安全默认 + 最小权限。

详细说明请参考 [rules/construct-design.md](rules/construct-design.md)

### TDD 工作流

本项目全面采用测试驱动开发 (TDD)。详见 [rules/testing.md](rules/testing.md)

---

## 代码风格

代码风格规范详见 [construct-design.md](rules/construct-design.md) 和 [project-structure.md](rules/project-structure.md)

---

## 项目结构

**架构模式**: CDK Construct 分层 (L1 → L2 → L3)，详见 [rules/architecture.md](rules/architecture.md)

**项目目录结构**: 详见 [rules/project-structure.md](rules/project-structure.md)

---

## 安全规范

详见 [rules/security.md](rules/security.md)

---

## 注意事项 (Gotchas)

| 项目 | 说明 |
|------|------|
| **CDK Context 缓存** | `cdk.context.json` 缓存 VPC/AZ 查询结果，值不符预期时删除此文件重新 synth |
| **CfnOutput 陷阱** | 使用 Fn.importValue 后，导出 Stack 无法修改/删除导出值，优先用 Props 传递 |
| **NAT Gateway 成本** | dev 环境慎用 NAT Gateway (~$30/月)，优先使用单个 NAT 或 NAT Instance |
| **包管理** | 仅使用 pnpm，禁止 npm/yarn |
| **--hotswap** | `cdk deploy --hotswap` 仅用于 dev 快速迭代，禁止在 staging/prod 使用 |
| **CDK Nag 版本** | cdk-nag 规则随版本变化，升级后可能出现新违规项 |

---

## PR Review 检查清单

完整检查清单见 [rules/checklist.md](rules/checklist.md)

**预提交一键验证**:
```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm cdk synth && pnpm test:coverage
```
