# 微信对接 OpenClaw 方案

## Context

ClawForce 已完成 Iter-1（CDK 基础设施、Bedrock 适配、ALB+HTTPS+WAF、监控），部署在 AWS EC2 上以 Docker Compose 运行 OpenClaw Gateway。

用户希望通过**个人微信**与 AI 员工对话（个人/团队内部使用）。调研发现 Wechaty puppet 生态已全面衰退（PadLocal 2022 年停更），因此选择 **chatgpt-on-wechat (CoW)**（41.6k stars，2026年仍活跃）作为微信连接层。

**核心思路**：CoW 负责微信登录和消息收发，将 LLM 请求转发到 OpenClaw Gateway 的 OpenAI 兼容 API（`/v1/chat/completions`），实现零开发的快速对接。

## 架构

```
微信用户 ←→ 个人微信 ←→ [CoW 容器] ←HTTP→ [OpenClaw Gateway :18789]
                                                    ↓
                                              Bedrock Claude
```

- CoW 和 OpenClaw Gateway 在同一个 Docker Compose 网络中
- CoW 通过 `open_ai_api_base = http://openclaw-gateway:18789/v1` 调用 OpenClaw
- 认证使用 `OPENCLAW_GATEWAY_TOKEN`（Bearer token）
- 无需新增外部端口，CoW 的微信协议走出站 HTTPS

## 实施步骤

### Step 1: 创建 CoW 服务目录和配置

**新建** `services/cow/config.json`：

```json
{
  "open_ai_api_key": "PLACEHOLDER_GATEWAY_TOKEN",
  "open_ai_api_base": "http://openclaw-gateway:18789/v1",
  "model": "openclaw",
  "channel_type": "wx",
  "single_chat_prefix": [""],
  "single_chat_reply_prefix": "",
  "group_chat_prefix": ["@bot"],
  "group_name_white_list": ["ALL_GROUP"],
  "conversation_max_tokens": 2000,
  "character_desc": "You are a ClawForce AI assistant.",
  "hot_reload": true
}
```

> `open_ai_api_key` 需替换为实际的 `OPENCLAW_GATEWAY_TOKEN` 值。`model` 字段为标签，Gateway 内部会解析到 Bedrock 配置的实际模型。

### Step 2: 创建 Docker Compose 扩展文件

**新建** `services/cow/docker-compose.cow.yml`：

```yaml
services:
  cow:
    image: zhayujie/chatgpt-on-wechat
    container_name: clawforce-cow
    volumes:
      - ../../services/cow/config.json:/app/config.json
      - cow-data:/app/data
    depends_on:
      - openclaw-gateway
    restart: unless-stopped

volumes:
  cow-data:
```

启动命令：
```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml -f services/cow/docker-compose.cow.yml up -d
```

### Step 3: 更新 CDK compute.ts（可选，用于自动化部署）

**修改** `infra/lib/constructs/compute.ts`

在 `# === Start OpenClaw ===` 部分之后、`# === CloudWatch Agent ===` 之前，插入 CoW 部署命令：

```bash
# === chatgpt-on-wechat (CoW) - WeChat Bridge ===
cat > /home/ubuntu/openclaw/docker-compose.cow.yml << 'COWCOMPOSE'
services:
  cow:
    image: zhayujie/chatgpt-on-wechat
    container_name: clawforce-cow
    volumes:
      - /home/ubuntu/cow/config.json:/app/config.json
      - cow-data:/app/data
    depends_on:
      - openclaw-gateway
    restart: unless-stopped
volumes:
  cow-data:
COWCOMPOSE

mkdir -p /home/ubuntu/cow
cat > /home/ubuntu/cow/config.json << 'COWCONFIG'
{
  "open_ai_api_key": "${gatewayToken}",
  "open_ai_api_base": "http://openclaw-gateway:18789/v1",
  "model": "openclaw",
  "channel_type": "wx",
  "single_chat_prefix": [""],
  "single_chat_reply_prefix": "",
  "group_chat_prefix": ["@bot"],
  "group_name_white_list": ["ALL_GROUP"],
  "conversation_max_tokens": 2000,
  "character_desc": "You are a ClawForce AI assistant.",
  "hot_reload": true
}
COWCONFIG
chown -R ubuntu:ubuntu /home/ubuntu/cow
```

同时更新 `docker compose up` 命令加上 `-f docker-compose.cow.yml`。

### Step 4: 微信登录（手动操作）

```bash
# SSH 到 EC2 后启动 CoW
docker compose -f docker-compose.yml -f docker-compose.override.yml -f docker-compose.cow.yml up -d

# 查看 CoW 日志，扫描二维码完成微信登录
docker logs -f clawforce-cow
```

> 用**专门的小号**扫码，不要用主号。

## 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `services/cow/config.json` | 新建 | CoW 配置，指向 OpenClaw API |
| `services/cow/docker-compose.cow.yml` | 新建 | CoW Docker Compose 扩展 |
| `infra/lib/constructs/compute.ts` | 修改 | CDK 自动化部署加入 CoW |
| `openclaw-fork/docker-compose.yml` | 不改 | 已有 Gateway 定义，CoW 通过扩展文件加入 |
| `openclaw-fork/src/gateway/openai-http.ts` | 不改 | 已有 `/v1/chat/completions` 端点 |

## 验证步骤

1. **网络连通性**：`docker exec clawforce-cow curl -s http://openclaw-gateway:18789/v1/models -H "Authorization: Bearer <token>"`
2. **API 兼容性**：直接 curl 测试 `/v1/chat/completions` 端点返回正常
3. **微信登录**：`docker logs clawforce-cow` 显示登录成功
4. **端到端**：用另一个微信号发消息给机器人号，收到 AI 回复

## 风险与缓解

| 风险 | 级别 | 缓解 |
|------|------|------|
| 微信封号 | 高 | 使用专门小号，限制消息频率 |
| itchat 登录 session 过期 | 中 | CoW 持久化 session 到 volume，`restart: unless-stopped` 自动恢复 |
| t3.medium 内存不足（CoW ~300MB + OpenClaw ~600MB） | 中 | CloudWatch 监控，必要时升 t3.large |
| CoW 与 OpenClaw API 兼容性 | 低 | CoW 只用基础 chat completion，OpenClaw 已完整支持 |

## 范围边界

**本次做**：CoW 配置 + Docker Compose 扩展 + CDK 部署脚本更新
**不做**：OpenClaw WeChat ChannelPlugin 开发（那是 Phase 2 深度集成，当前方案已满足个人/团队使用）
