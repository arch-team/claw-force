# RISK-001：飞书真实凭据提交到版本控制

- **严重度**：High
- **状态**：open
- **发现来源**：/pace-review 对抗审查（CR-011）
- **关联 CR**：CR-011
- **发现日期**：2026-03-04

## 风险描述

`infra/cdk.json` 中包含真实的飞书应用凭据：
- `feishuAppId: "cli_a92ef55d4f38dbc8"`
- `feishuAppSecret: "jPfAmiUtSqVF0UOdeYZWMfNXJ5KQ4ji0"`

这些凭据已提交到 Git 版本历史中。如果仓库被公开或凭据被第三方获取，攻击者可以：
1. 冒充飞书 Bot 发送消息
2. 读取 Bot 接收的消息内容
3. 调用飞书开放平台 API 获取企业数据

## 严重度判定

| 维度 | 等级 | 依据 |
|------|------|------|
| 安全敏感度 | **High** | 涉及第三方平台认证凭据（appSecret），属于加密/权限核心 |
| 历史教训 | Medium | insights.md 无直接匹配的 defense pattern，但上次会话已识别此问题 |
| 依赖影响 | Low | 仅影响 cdk.json 1 个文件 |
| 架构兼容性 | Medium | CLAUDE.md 规定 CDK context 传入凭据，但未强制要求占位符 |
| 范围复杂度 | Low | 修复范围明确 |

综合风险等级：**High**（取最高维度）

## 缓解方案

### 方案 A：CDK context 占位符 + 环境变量注入（推荐）

1. 将 cdk.json 中凭据替换为占位符（空字符串）
2. 部署时通过 CDK context 参数注入：cdk deploy -c feishuAppId=cli_xxx -c feishuAppSecret=xxx
3. 优点：零代码改动，与现有 CDK context 模式一致
4. 缺点：凭据出现在命令行历史中

### 方案 B：AWS SSM Parameter Store（更安全）

1. 将凭据存储到 SSM Parameter Store（SecureString 类型）
2. CDK Stack 中通过 ssm.StringParameter.valueForStringParameter() 读取
3. 优点：凭据不出现在任何文件或命令行中
4. 缺点：需要改动 CDK 代码（约 10 行）

### 补充操作（无论选哪个方案）

- 在飞书开放平台重新生成 App Secret（已泄露的 secret 应视为失效）
- 评估是否需要从 Git 历史中清除（git filter-branch 或 BFG Repo-Cleaner）
- 在 .gitignore 或 pre-commit hook 中添加凭据检测规则

## 事件

| 日期 | 事件 | 备注 |
|------|------|------|
| 03-04 | 创建风险记录 | /pace-review 对抗审查发现，用户确认追踪 |
