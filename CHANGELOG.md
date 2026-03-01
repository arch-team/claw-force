# Changelog

All notable changes to ClawForce will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-03-01

### Features

- [CR-006] CDK 基础设施全面优化（PF-010 CDK 代码质量与工程实践）
  - 删除死代码，统一 Props 命名为 ClawForce{Name}Props 格式
  - 添加 ESLint v10 + Prettier 工具链
  - 为 6 个 constructs 补全独立单元测试，测试从 39 → 90
  - 集成 cdk-nag AwsSolutionsChecks（resource-level suppressions）
  - 目录重构：lib/stacks/ + lib/config/constants.ts
  - 提取 UserData builder 模块和 Docker assets

### Infrastructure

- 测试覆盖率提升 130%（39 → 90 个测试用例）
- 代码规范自动化（ESLint + Prettier + CDK Nag）
- 消除 magic numbers，集中常量管理
- 加固 .env 文件权限（chmod 600）

## [0.1.0] - 2026-02-28

### Features

- [CR-001] CDK TypeScript 基础设施自动化部署（PF-001 IaC 自动化部署）- 将 PoC 手动部署转为 CDK TypeScript，涵盖 EC2+SG+IAM+EBS 全栈，内嵌 6 条 PoC 修复项
- [CR-002] Bedrock 模型验证与配置增强（PF-002 Bedrock 模型适配层）- Inference Profile 格式适配、模型发现脚本、IAM 策略自动配置
- [CR-003] ALB+HTTPS+WAF 企业级网络安全基线（PF-003 企业级网络安全基线）- ALB 双模式架构（ALB vs 直连），WAF WebACL 速率限制
- [CR-004] CloudWatch 基础运维可观测性（PF-004 基础运维可观测性）- 日志组、CPU/StatusCheck 告警、CloudWatch Agent 集成
- [CR-005] CDK 基础设施自动化测试覆盖（PF-009 CDK 基础设施自动化测试覆盖）- 39 个 Jest 测试覆盖所有 construct 和 stack 双模式

### Infrastructure

- 完成 OpenClaw→ClawForce 核心企业化适配
- 实现从 PoC 手动验证到可重复自动化部署的升级
- 建立 13 个 AWS 资源的完整 IaC 基础设施
- 集成 CloudWatch 监控和告警系统

[0.2.0]: https://github.com/your-org/claw-force/releases/tag/v0.2.0
[0.1.0]: https://github.com/your-org/claw-force/releases/tag/v0.1.0
