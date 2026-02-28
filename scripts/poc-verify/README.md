# OpenClaw PoC 验证工具

对 AWS EC2 上部署的 OpenClaw 实例进行全面功能验证。

## 前置条件

1. **部署完成**: `scripts/aws-deploy/` 中的 01-04 脚本已成功执行
2. **AWS CLI**: 已安装并配置
3. **SSH 访问**: 能连接到 EC2 实例

## 验证脚本

| 脚本 | 验证范围 | 自动化程度 |
|------|---------|-----------|
| `poc-01-core.sh` | Gateway、模型、安全配置 | 完全自动 |
| `poc-02-channels.sh` | WebChat、Telegram、Slack、Discord | 自动检测 + 手动验证 |
| `poc-03-agents.sh` | SubAgent、角色配置、工作区 | 自动检测 + 手动验证 |
| `poc-04-plugins.sh` | 插件、Skills、Cron、Hooks | 自动检测 + 手动验证 |
| `poc-05-browser.sh` | Chromium、Playwright、浏览器工具 | 自动检测 + 手动验证 |

## 快速开始

```bash
# 依次执行所有验证
cd scripts/poc-verify
bash poc-01-core.sh
bash poc-02-channels.sh
bash poc-03-agents.sh
bash poc-04-plugins.sh
bash poc-05-browser.sh
```

## 手动验证

部分功能需要通过 Control UI 手动验证。建立 SSH Tunnel:

```bash
# 从本地机器执行
ssh -i ~/.ssh/openclaw-poc-key -L 18789:localhost:18789 ubuntu@<EC2_IP>

# 浏览器访问
open http://localhost:18789
```

### 核心对话验证

1. 在 WebChat 中发送: "你好，请介绍一下你自己"
2. 继续发送: "我刚才问了你什么？" (验证多轮上下文)
3. 开启新会话，发送: "你记得我之前和你说过什么吗？" (验证记忆系统)

### Agent 协作验证

1. 发送: "请帮我创建一个子 Agent 来搜索最新的 AI 新闻"
2. 观察 SubAgent 创建和任务委托过程

### 浏览器自动化验证

1. 发送: "请访问 https://example.com 并告诉我页面内容"
2. 发送: "请对 https://news.ycombinator.com 截图"

## 输出

- 每个脚本生成 `results-XX-*.txt` 结果文件
- 使用 `poc-report-template.md` 模板整理最终报告

## 安全说明

- 验证脚本通过 SSH 连接 EC2，不会在本地存储敏感信息
- Gateway Token 存储在 EC2 实例的 `~/.openclaw/.gateway-token`（权限 600）
- 所有自动化检查使用 IAM Role 凭证（无 Access Key 传输）
