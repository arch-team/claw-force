# ClawForce

**项目名称**：ClawForce

**项目描述**：基于 OpenClaw 的 AI 员工平台 — 让企业管理者像管理真实团队一样创建、配置和管理 AI 员工

**项目定位**：Your AI Workforce, Unleashed

---

## 业务目标

将 OpenClaw 从开源个人 AI 助手转变为企业级 AI 员工管理平台，实现安全、可重复、可观测的自动化部署。

## 价值功能树

<!-- 格式：`- [BR] 业务结果` / `  - [PF] 产品功能（用户故事）` / `    - [CR] 变更请求（backlog/CR-XXX.md）` -->

- [BR-001] 企业级 AI 员工平台基础设施 <!-- source: claude -->
  - [PF-001] 🚀 IaC 自动化部署 — 将 PoC 手动部署转为 CDK TypeScript，涵盖 EC2+SG+IAM+EBS 全栈，内嵌所有 PoC 修复项 <!-- source: claude -->
    - [CR-001] 🚀 CDK TypeScript 基础设施自动化部署（released via REL-001）
  - [PF-002] 🚀 Bedrock 模型适配层 — OpenClaw 中适配 Inference Profile 格式、模型发现、IAM 策略自动配置 <!-- source: claude -->
    - [CR-001] 🚀 Inference Profile 格式 + IAM 策略（CR-001 溢出覆盖）
    - [CR-002] 🚀 Bedrock 模型验证与配置增强（released via REL-001）
  - [PF-003] 🚀 企业级网络安全基线 — ALB + HTTPS + WAF 替代直接端口暴露，SG 策略优化 <!-- source: claude -->
    - [CR-003] 🚀 ALB+HTTPS+WAF 企业级网络安全基线（released via REL-001）
    - [CR-007] 🐛 ALB Target Group 端口修正（适配 OpenClaw 实际端口分配）
    - [CR-008] 🐛 Gateway CORS 配置适配 ALB（修复 origin not allowed 错误）
  - [PF-004] 🚀 基础运维可观测性 — CloudWatch 日志/指标集成，Gateway 健康检查，基本告警 <!-- source: claude -->
    - [CR-004] 🚀 CloudWatch 基础运维可观测性（released via REL-001）
  - [PF-009] 🚀 CDK 基础设施自动化测试覆盖 — Jest 测试覆盖所有 construct 和 stack 双模式 <!-- source: user -->
    - [CR-005] 🚀 CDK 基础设施自动化测试覆盖（released via REL-001）
  - [PF-010] 🚀 CDK 代码质量与工程实践 — ESLint/Prettier 工具链、cdk-nag 合规、目录重构、测试倍增 <!-- source: user -->
    - [CR-006] 🚀 CDK 基础设施全面优化（released via REL-002）
- [BR-004] AI 员工业务场景集成 <!-- source: user -->
  - [PF-011] ✅ 部署验证与对话功能恢复 — cdk deploy 端到端验证，确认 CR-007/008/009 修复后 OpenClaw 对话功能正常 <!-- source: claude -->
    - [CR-010] ✅ 部署验证（代码状态确认，97→108 tests 通过）
  - [PF-012] 🔄 飞书 AI 员工 Bot 集成 — 启用 OpenClaw 内置飞书 Channel 插件（WebSocket 模式）+ Hooks API <!-- source: user -->
    - [CR-011] 🔄 飞书 Channel + Hooks API CDK 配置层（in_review）
  - [PF-013] 🔄 集成验证与 MoS 度量 — 定义并度量成效指标（对话成功率、响应延迟等），验证端到端业务价值 <!-- source: claude -->
    - [CR-012] 🔄 MoS 指标定义（5 指标 + 6 项验证清单，in_review）
- [BR-002] 企业级用户管理与安全 <!-- source: claude -->
  - [PF-005] ⏳ 设备配对企业化与 SSO 集成 <!-- source: claude -->
  - [PF-006] ⏳ Gateway OAuth 认证升级 <!-- source: claude -->
  - [PF-007] ⏳ 多用户隔离（multi-tenant） <!-- source: claude -->
- [BR-003] 生产级运维与高可用 <!-- source: claude -->
  - [PF-008] ⏳ 数据库外置与高可用方案 <!-- source: claude -->

---

## 范围

**做什么**：基于 OpenClaw 开源框架进行企业化适配，包括 AWS 基础设施自动化、Bedrock 模型集成、网络安全加固、运维监控

**不做什么**：不 fork OpenClaw 源码（优先通过配置和外部集成方式适配）、不构建自有 AI 推理层、不开发移动端

---

## 项目原则

（技术/产品决策讨论时追加）
