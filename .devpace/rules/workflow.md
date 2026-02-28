# 工作流规则

## CR 生命周期

```
draft → planning → in_progress → in_review → merged
                                          ↓
                                      blocked
```

**状态定义**：
- `draft`：想法阶段，需求不明确
- `planning`：需求已确认，等待实现规划
- `in_progress`：正在实现
- `in_review`：实现完成，等待质量门检查
- `blocked`：被阻塞，需要解决依赖或问题
- `merged`：已合并到主分支
- `cancelled`：已取消

## 质量门（Gate）

**Gate 1 - 进入 planning**：
- 需求描述清晰（谁、做什么、为什么）
- 验收标准明确

**Gate 2 - 进入 in_review**：
- 代码变更已提交
- 自测通过
- 执行 checks.md 中的检查项

**Gate 3 - 进入 merged**：
- `/pace-review` 通过（或人工确认通过）
- 验收标准全部满足

## Hotfix 路径

生产环境紧急修复可绕过 planning 直接进入 in_progress，但仍需通过 Gate 2 和 Gate 3。

## 外部同步（可选）

配置 `/pace-sync` 后，CR 状态变更可自动同步到 GitHub Issues 或 Linear。
