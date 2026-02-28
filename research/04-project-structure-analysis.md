# OpenClaw 项目结构与技术栈分析

## 项目概况

| 维度 | 值 |
|------|---|
| 版本 | 2026.2.27 |
| 许可 | MIT |
| 代码量 | ~4900 .ts 文件 |
| 更名历史 | Warelay → Clawdbot → Moltbot → OpenClaw |
| Stars | 237K+ |

## Monorepo 结构

pnpm Workspace (pnpm 10.23.0)，4 层工作区，30+ 独立 npm 包:

```yaml
packages:
  - .              # 根包（openclaw 主体）
  - ui             # 前端 UI (Lit 3.x + Vite 7.x)
  - packages/*     # 兼容性 shim (clawdbot/moltbot)
  - extensions/*   # 39 个扩展/渠道插件
```

## 顶层目录

| 目录 | 文件数 | 用途 |
|------|--------|------|
| `src/` | 3942 .ts | 核心源码 (49 个子模块) |
| `extensions/` | 39 个扩展 | 渠道/功能插件 |
| `skills/` | 52 个技能 | SKILL.md 定义 |
| `ui/` | - | Web 控制面板 (Lit + Vite + Playwright) |
| `apps/` | - | 原生客户端 (macOS/iOS/Android) |
| `Swabble/` | - | Swift Package |
| `docs/` | 46 子目录 | Mint 文档站 |
| `scripts/` | 97 文件 | 构建/部署/检查脚本 |
| `test/` | - | 测试基础设施 |
| `vendor/` | - | 第三方 (a2ui 渲染器) |
| `packages/` | 2 | 兼容性 shim |

## src/ 核心模块 (Top 20)

| 模块 | .ts 数 | 职责 |
|------|--------|------|
| `agents/` | 687 | Agent 核心：工具(78种)/生命周期/bash/认证/沙箱/ACP |
| `infra/` | 325 | 基础设施：环境/二进制/网络/端口/dotenv/更新 |
| `commands/` | 319 | CLI 命令：所有 `openclaw <cmd>` 子命令 |
| `gateway/` | 296 | 网关：WebSocket/HTTP API/桥接/控制面板/会话 |
| `cli/` | 259 | CLI 框架：Commander/依赖注入/提示交互 |
| `auto-reply/` | 246 | 自动回复：消息管道/模板/历史/流式 |
| `config/` | 199 | 配置：JSON 加载/Zod 验证/运行时策略 |
| `channels/` | 145 | 渠道抽象：统一接口/注册表/允许列表 |
| `discord/` | 128 | Discord 集成 |
| `browser/` | 122 | 浏览器自动化 (Playwright) |
| `telegram/` | 103 | Telegram 集成 |
| `slack/` | 92 | Slack 集成 |
| `memory/` | 86 | 记忆：向量存储/FTS5/Gemini 批处理 |
| `web/` | 80 | WhatsApp (Baileys) |
| `cron/` | 75 | 定时任务 |
| `plugins/` | 64 | 插件运行时 |
| `media-understanding/` | 51 | 媒体解析 (图片/PDF/文档) |
| `line/` | 46 | LINE 集成 |
| `tui/` | 45 | 终端 UI |
| `acp/` | 43 | Agent Client Protocol |

其他: plugin-sdk(36), hooks(38), security(29), providers(11), tts(4), routing(10)

## 关键依赖

| 包 | 版本 | 用途 |
|----|------|------|
| zod | ^4.3.6 | 运行时类型验证 |
| commander | ^14.0.3 | CLI 框架 |
| playwright-core | 1.58.2 | 浏览器自动化 |
| sharp | ^0.34.5 | 图片处理 |
| ws | ^8.19.0 | WebSocket |
| undici | ^7.22.0 | HTTP 客户端 |
| chokidar | ^5.0.0 | 文件监控 |
| @lydell/node-pty | - | 伪终端 |
| grammy | - | Telegram Bot |
| @slack/bolt | - | Slack |
| @larksuiteoapi/node-sdk | - | 飞书 |
| @line/bot-sdk | - | LINE |

## 构建与部署

| 工具 | 说明 |
|------|------|
| tsdown | 8 个 entry point 的 bundle |
| Vitest | 5 种测试配置 (unit/e2e/live/gateway/extensions) |
| Docker | 3 种镜像 (main/sandbox/sandbox-browser) |
| Fly.io | 云部署 |
| Render | 云部署 |
| GitHub Actions | 8 个 workflow |

## 架构特征总结

1. **Gateway-Client 架构**: Express + WS 网关，多种客户端连接方式
2. **Plugin-First**: 核心精简，渠道和功能通过扩展插件实现
3. **多 Agent**: 自有 LLM + ACP 外部 Agent 桥接
4. **安全优先**: 沙箱/SSRF防护/DM策略/设备配对/secret检测
5. **跨平台**: Node.js + Swift (macOS/iOS) + Kotlin (Android) + Web
6. **MCP 集成**: 通过 mcporter 桥接模式
