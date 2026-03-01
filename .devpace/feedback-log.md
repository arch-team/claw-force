# 反馈日志

## FB-001: OpenClaw 对话失败 - Anthropic API 凭证缺失

- **ID**: FB-001
- **分类**: 生产事件（Production Event）
- **严重度**: High
- **状态**: tracked
- **关联 CR**: CR-009
- **报告日期**: 2026-03-01
- **报告来源**: 用户使用反馈
- **发生环境**: production (REL-002, i-0bad836a988d3c6fd)

### 问题描述

用户尝试与 OpenClaw 对话时收到错误：

```
⚠️ Agent failed before reply: No API key found for provider "anthropic".
Auth store: /home/node/.openclaw/agents/main/agent/auth-profiles.json
(agentDir: /home/node/.openclaw/agents/main/agent).
Configure auth for this agent (openclaw agents add <id>) or
copy auth-profiles.json from the main agentDir.
```

### 影响范围

- **核心功能**: AI 对话完全不可用
- **用户体验**: 无法使用平台核心服务
- **业务影响**: 平台功能完全失效

### 价值链追溯

- **产品功能**: PF-002 (Bedrock 模型适配层)
- **业务结果**: BR-001 (企业级 AI 员工平台基础设施)
- **迭代**: Iter-1

### 初步根因分析

OpenClaw 容器启动后无法获取 Anthropic/Bedrock 访问凭证。可能原因：

1. **auth-profiles.json 文件不存在**: 容器期望路径 `/home/node/.openclaw/agents/main/agent/auth-profiles.json` 文件缺失
2. **Bedrock 凭证链未配置**: OpenClaw 未配置通过 AWS SDK 默认凭证链（IAM Role → IMDS）访问 Bedrock
3. **IAM Role 权限不足**: EC2 instance profile 可能缺少 `bedrock:InvokeModel` 等权限
4. **IMDS 访问受阻**: Docker 容器可能无法访问 EC2 IMDSv2 获取临时凭证

### 相关部署信息

- **Release**: REL-002 (v0.2.0)
- **Instance**: i-0bad836a988d3c6fd (34.213.193.239)
- **Docker volume**: `./config:/home/node/.openclaw`
- **Environment**: `OPENCLAW_GATEWAY_TOKEN` 已设置（但这是 Gateway token，非 Bedrock 凭证）

### 关联变更

- CR-006: CDK 基础设施全面优化（REL-002）
- PF-002 相关的 Bedrock 模型配置（CR-002, REL-001）

### 下一步行动

- [x] 创建 FB-001 记录
- [x] 创建 defect CR（CR-009）
- [ ] 调查 User Data 脚本中 auth-profiles.json 创建逻辑
- [ ] 验证 IAM Role 是否有 Bedrock 权限
- [ ] 测试 Docker 容器内 IMDS 访问
- [ ] 修复并部署热修复

### 事件时间线

| 时间 | 事件 | 操作者 |
|------|------|--------|
| 03-01 | REL-002 部署完成 | Claude |
| 03-01 | 用户报告对话失败 | 用户 |
| 03-01 | 创建 FB-001 | Claude |
| 03-01 | 创建 CR-009（High defect） | Claude |
