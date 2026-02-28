<!-- devpace-start -->
# DevPace 集成

本项目使用 devpace 进行开发节奏管理。

## 项目信息

- **项目名称**：ClawForce
- **项目定位**：Your AI Workforce, Unleashed
- **项目描述**：基于 OpenClaw 的 AI 员工平台 — 让企业管理者像管理真实团队一样创建、配置和管理 AI 员工

## DevPace 核心概念

- **CR (Change Request)**：变更请求，devpace 的基本工作单元，存储在 `.devpace/backlog/` 目录
- **质量门（Gate）**：CR 状态转换的检查点，确保质量标准
- **价值功能树**：从业务结果（BR）→ 产品功能（PF）→ 变更请求（CR）的层次结构

## 常用命令

- `/pace-status`：查看项目进度和当前工作
- `/pace-dev`：开始或继续实现 CR
- `/pace-change`：管理需求变更（添加、暂停、恢复、调整优先级）
- `/pace-review`：执行质量门检查
- `/pace-retro`：迭代回顾和度量分析

## 工作流程

1. **自然语言启动**：直接说"帮我实现/修复/添加 XXX"，devpace 会自动创建 CR
2. **质量门检查**：CR 进入 `in_review` 状态时自动执行 `.devpace/rules/checks.md` 中的检查项
3. **状态追踪**：所有工作状态记录在 `.devpace/state.md`

## 配置文件位置

- 项目状态：`.devpace/state.md`
- 项目规划：`.devpace/project.md`
- 工作流规则：`.devpace/rules/workflow.md`
- 质量检查：`.devpace/rules/checks.md`
- CR 存储：`.devpace/backlog/CR-*.md`

---

**注意**：`.devpace/` 目录内容由 devpace 管理，请勿手动编辑（除非你知道自己在做什么）。
<!-- devpace-end -->
