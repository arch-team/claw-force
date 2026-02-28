# 经验积累

## Active

<!-- 活跃经验：置信度 ≥ 0.4 且近 180 天有引用 -->

### Bedrock Inference Profile 完整适配链

- **类型**：防御
- **来源**：手动沉淀（PoC 验证 poc-report.md #5 #6）
- **标签**：AWS、Bedrock、IAM、部署
- **描述**：OpenClaw 默认使用直接模型 ID（如 `anthropic.claude-opus-4-6-v1`），但 Bedrock 需要 Inference Profile 格式（如 `us.anthropic.claude-opus-4-6-v1`，带区域前缀）。同时 IAM 策略必须同步添加 `inference-profile/*` 资源 ARN，否则即使模型 ID 正确也会被拒。两者缺一不可。
- **置信度**：0.5
- **最近引用**：（未引用）
- **验证次数**：0
- **状态**：Active
- **冲突对**：无
- **日期**：2026-02-28

---

### Docker 容器 AWS 凭证链配置

- **类型**：防御
- **来源**：手动沉淀（PoC 验证 poc-report.md #4 #10）
- **标签**：AWS、Docker、IAM、IMDSv2、部署
- **描述**：Docker 容器通过 Instance Metadata 获取 IAM 凭证时需注意两点：(1) IMDSv2 hop limit 必须设为 2（默认 1 不够容器内额外一跳）；(2) Docker Compose 中必须显式注入 `AWS_REGION` 环境变量（通过 docker-compose.override.yml），因为容器内 SDK 无法自动推断区域。
- **置信度**：0.5
- **最近引用**：（未引用）
- **验证次数**：0
- **状态**：Active
- **冲突对**：无
- **日期**：2026-02-28

---

### OpenClaw Gateway 首次启动三步配置

- **类型**：模式
- **来源**：手动沉淀（PoC 验证 poc-report.md #7 #8 #9）
- **标签**：OpenClaw、Gateway、部署、配置
- **描述**：OpenClaw Gateway 首次启动需完成三步配置才能正常使用：(1) 设置 `gateway.mode=local`；(2) 配置 `allowedOrigins` 为 Control UI 地址（如 localhost:18789）解决 WebSocket 跨域；(3) 通过 `devices approve` 命令授权新设备的 WebSocket 连接。三步顺序执行，缺一不可。
- **置信度**：0.5
- **最近引用**：（未引用）
- **验证次数**：0
- **状态**：Active
- **冲突对**：无
- **日期**：2026-02-28

---

### AWS API 输入需严格 ASCII 字符

- **类型**：防御
- **来源**：手动沉淀（PoC 验证 poc-report.md #1）
- **标签**：AWS、API、字符编码、部署
- **描述**：AWS API 的 description 等文本字段不接受非 ASCII 字符（如中文破折号 `—`、全角符号等），会导致 API 调用失败。IaC 脚本和 Terraform 中的描述字段应统一使用标准 ASCII 字符（用 `-` 替代 `—`）。
- **置信度**：0.5
- **最近引用**：（未引用）
- **验证次数**：0
- **状态**：Active
- **冲突对**：无
- **日期**：2026-02-28

---

### Ubuntu 24.04 LTS 基础服务名变更

- **类型**：防御
- **来源**：手动沉淀（PoC 验证 poc-report.md #2）
- **标签**：Ubuntu、SSH、OS、部署
- **描述**：Ubuntu 24.04 LTS 将 SSH 服务名从 `sshd.service` 改为 `ssh.service`。User Data 脚本、Ansible playbook 等涉及 SSH 服务管理的自动化脚本需适配此变更，否则 `systemctl restart sshd` 等命令会失败。
- **置信度**：0.5
- **最近引用**：（未引用）
- **验证次数**：0
- **状态**：Active
- **冲突对**：无
- **日期**：2026-02-28

---

### 多出口 IP 环境的 Security Group 策略

- **类型**：防御
- **来源**：手动沉淀（PoC 验证 poc-report.md #3）
- **标签**：AWS、网络、Security Group、部署
- **描述**：通过 HTTP API 检测到的出口 IP 与实际 SSH 连接的源 IP 可能不一致（如企业网络多出口、VPN 分流等场景）。Security Group 规则不能仅依赖 HTTP 检测到的 IP，需实际验证 SSH 连接源 IP 后再配置 ingress 规则，或预留 CIDR 范围而非单 IP。
- **置信度**：0.5
- **最近引用**：（未引用）
- **验证次数**：0
- **状态**：Active
- **冲突对**：无
- **日期**：2026-02-28

---

## Dormant

<!-- 休眠经验：置信度 < 0.4 或超 180 天未引用 -->

## Archived

<!-- 已归档：Dormant 超 360 天且验证次数 = 0 -->
