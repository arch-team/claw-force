# ClawForce

**"Your AI Workforce, Unleashed"**

基于 OpenClaw 的 AI 员工平台 — 让企业管理者像管理真实团队一样创建、配置和管理 AI 员工。

## 项目状态

Phase 1: OpenClaw 技术深度剖析 (进行中)

## 目录结构

```
claw-force/
├── docs/                  # 项目文档 (PRD, ADR, 架构图)
├── research/              # 调研报告 (竞品分析, 技术评估)
├── openclaw-fork/         # OpenClaw Fork (最小差异扩展)
└── scripts/               # 工具脚本
```

## 快速开始

```bash
# 1. Clone OpenClaw
cd openclaw-fork
git clone https://github.com/nicepkg/openclaw.git .

# 2. 安装依赖
pnpm install

# 3. 启动开发环境
pnpm dev
```

## 核心概念

- **AI Employee**: 扩展自 OpenClaw Agent，具备岗位角色、技能集、工作记忆
- **AI Dev Team (MVP)**: PM + Developer + QA 协作完成软件开发任务
- **三层架构**: Enterprise Admin UI → Enterprise API → OpenClaw Core

## 关键资源

- [OpenClaw](https://github.com/openclaw/openclaw) - 核心 AI Agent 平台 (237K+ stars)
- [调研设计方案](./docs/plan.md) - 完整项目规划
