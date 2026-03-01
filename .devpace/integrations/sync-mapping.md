# 同步映射配置

## 平台

- **类型**：github
- **连接**：arch-team/claw-force
- **同步模式**：push
- **冲突策略**：ask-user

## CR 状态映射

| devpace 状态 | 外部状态 | 同步方向 | 备注 |
|-------------|---------|---------|------|
| created | 待办 | ↔ | GitHub: `backlog` 标签 |
| developing | 进行中 | ↔ | GitHub: `in-progress` 标签 |
| verifying | 待审查 | → | GitHub: `needs-review` 标签 |
| in_review | 等待审批 | → | GitHub: `awaiting-approval` 标签 |
| approved | 已批准 | → | GitHub: `approved` 标签 |
| merged | 已完成 | ↔ | GitHub: 关闭 Issue + `done` 标签 |
| released | 已发布 | → | GitHub: `released` 标签 |
| paused | 搁置 | ↔ | GitHub: `on-hold` 标签 |

## 实体映射

| devpace 概念 | 外部概念 | 说明 |
|-------------|---------|------|
| BR（业务需求） | Milestone | 业务需求对应 GitHub Milestone |
| PF（产品功能） | Epic / 大 Issue | 产品功能对应 GitHub Issue |
| CR（变更请求） | Issue | 变更请求对应 GitHub Issue |
| Release | Release | Release 对应 GitHub Release |

## Gate 结果同步

### Gate 1（开发完成门禁）

| 结果 | 外部动作 | 说明 |
|------|---------|------|
| 通过 | Comment + gate-1-passed 标签 | 在关联 Issue 添加通过评论和标签 |
| 未通过 | Comment（含失败摘要） | 在关联 Issue 添加失败原因评论 |

### Gate 2（审批门禁）

| 结果 | 外部动作 | 说明 |
|------|---------|------|
| 通过 | PR Review（approve） | 在关联 PR 提交 approve review |
| 未通过 | Comment（含未通过项） | 在关联 Issue 添加未通过详情评论 |

### Gate 3（发布门禁）

| 结果 | 外部动作 | 说明 |
|------|---------|------|
| 待处理 | PR Review（request changes）+ review 摘要 | 在关联 PR 请求变更并附摘要 |
| 通过 | Comment + gate-3-passed 标签 | 在关联 Issue 添加通过评论和标签 |

## 关联记录

<!-- 以下记录由 /pace-sync link 自动维护，请勿手动编辑 -->

| CR | 外部实体 | 关联时间 | 最后同步 |
|----|---------|---------|---------|
| CR-001 | github#2 | 2026-03-01 12:00 | 2026-03-01 12:00 |
| CR-002 | github#3 | 2026-03-01 12:00 | 2026-03-01 12:00 |
| CR-003 | github#4 | 2026-03-01 12:00 | 2026-03-01 12:00 |
| CR-004 | github#5 | 2026-03-01 12:00 | 2026-03-01 12:00 |
| CR-005 | github#6 | 2026-03-01 12:00 | 2026-03-01 12:00 |
| CR-006 | github#7 | 2026-03-01 12:00 | 2026-03-01 12:00 |
| CR-007 | github#1 | 2026-03-01 12:00 | 2026-03-01 12:00 |
