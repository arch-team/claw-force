# 经验积累

## Active

<!-- 活跃经验：置信度 ≥ 0.4 且近 180 天有引用 -->

### Bedrock Inference Profile 完整适配链

- **类型**：防御
- **来源**：手动沉淀（PoC 验证 poc-report.md #5 #6）
- **标签**：AWS、Bedrock、IAM、部署
- **描述**：OpenClaw 默认使用直接模型 ID（如 `anthropic.claude-opus-4-6-v1`），但 Bedrock 需要 Inference Profile 格式（如 `us.anthropic.claude-opus-4-6-v1`，带区域前缀）。同时 IAM 策略必须同步添加 `inference-profile/*` 资源 ARN，否则即使模型 ID 正确也会被拒。两者缺一不可。
- **置信度**：0.7
- **最近引用**：CR-001（2026-02-28，嵌入 iam.ts + compute.ts）
- **验证次数**：1
- **状态**：Active
- **冲突对**：无
- **日期**：2026-02-28

---

### Docker 容器 AWS 凭证链配置

- **类型**：防御
- **来源**：手动沉淀（PoC 验证 poc-report.md #4 #10）
- **标签**：AWS、Docker、IAM、IMDSv2、部署
- **描述**：Docker 容器通过 Instance Metadata 获取 IAM 凭证时需注意两点：(1) IMDSv2 hop limit 必须设为 2（默认 1 不够容器内额外一跳）；(2) Docker Compose 中必须显式注入 `AWS_REGION` 环境变量（通过 docker-compose.override.yml），因为容器内 SDK 无法自动推断区域。
- **置信度**：0.7
- **最近引用**：CR-001（2026-02-28，嵌入 compute.ts HttpPutResponseHopLimit + override.yml）
- **验证次数**：1
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
- **置信度**：0.7
- **最近引用**：CR-001（2026-02-28，networking.ts + compute.ts 全部使用 ASCII 描述）
- **验证次数**：1
- **状态**：Active
- **冲突对**：无
- **日期**：2026-02-28

---

### Ubuntu 24.04 LTS 基础服务名变更

- **类型**：防御
- **来源**：手动沉淀（PoC 验证 poc-report.md #2）
- **标签**：Ubuntu、SSH、OS、部署
- **描述**：Ubuntu 24.04 LTS 将 SSH 服务名从 `sshd.service` 改为 `ssh.service`。User Data 脚本、Ansible playbook 等涉及 SSH 服务管理的自动化脚本需适配此变更，否则 `systemctl restart sshd` 等命令会失败。
- **置信度**：0.7
- **最近引用**：CR-001（2026-02-28，compute.ts User Data 使用 ssh.service）
- **验证次数**：1
- **状态**：Active
- **冲突对**：无
- **日期**：2026-02-28

---

### 多出口 IP 环境的 Security Group 策略

- **类型**：防御
- **来源**：手动沉淀（PoC 验证 poc-report.md #3）
- **标签**：AWS、网络、Security Group、部署
- **描述**：通过 HTTP API 检测到的出口 IP 与实际 SSH 连接的源 IP 可能不一致（如企业网络多出口、VPN 分流等场景）。Security Group 规则不能仅依赖 HTTP 检测到的 IP，需实际验证 SSH 连接源 IP 后再配置 ingress 规则，或预留 CIDR 范围而非单 IP。
- **置信度**：0.7
- **最近引用**：CR-001（2026-02-28，networking.ts 参数化 allowedCidr 支持 CIDR 范围）
- **验证次数**：1
- **状态**：Active
- **冲突对**：无
- **日期**：2026-02-28

---

### CDK TypeScript 优于 Terraform 的场景判断

- **类型**：模式
- **来源**：自动提取（CR-001 merged，用户方案调整反馈）
- **标签**：CDK、Terraform、IaC、技术选型
- **描述**：当目标项目已使用 Node.js 生态（如 OpenClaw）时，CDK TypeScript 优于 Terraform：(1) 技术栈统一减少学习成本；(2) L2 构建体自动处理最佳实践（如 Instance Profile 自动绑定）；(3) TypeScript 类型安全在编译期捕获错误；(4) 单 Stack 结构适合首迭代快速验证。
- **置信度**：0.6
- **最近引用**：CR-001（2026-02-28，用户决策 Terraform→CDK TypeScript）
- **验证次数**：1
- **状态**：Active
- **冲突对**：无
- **日期**：2026-02-28

---

### ALB 双模式架构保持向后兼容

- **类型**：模式
- **来源**：自动提取（CR-003 merged）
- **标签**：ALB、安全、CDK、架构
- **描述**：在 CDK 中引入 ALB 安全层时，使用 `enableAlb` 布尔参数实现双模式：(1) ALB 模式（默认）EC2 SG 仅接受 ALB 流量；(2) 直连模式（enableAlb=false）保持原有 CIDR 规则。Networking 构建体精简为仅 SSH，OpenClaw 端口规则由 Stack 层根据模式动态管理，避免循环依赖。
- **置信度**：0.6
- **最近引用**：CR-003（2026-02-28）
- **验证次数**：1
- **状态**：Active
- **冲突对**：无
- **日期**：2026-02-28

---

### CDK 测试中 CloudFormation 属性名与 CDK Props 名称不一致

- **类型**：防御
- **来源**：自动提取（CR-005 merged，retro 迭代回顾 Iter-1）
- **标签**：CDK、测试、CloudFormation、Jest
- **描述**：CDK L2 construct 的 prop 名称与 CloudFormation 模板中的属性名可能不同（如 CDK `loadBalancerName` → CFn `Name`，CDK `targetGroupName` → CFn `Name`）。编写 CDK assertion 测试时必须使用 CFn 属性名而非 CDK prop 名。此外 `requireImdsv2` 生成 LaunchTemplate 而非直接设置 Instance 的 MetadataOptions.HttpTokens，`logGroupName` 在 getAgentConfig 中返回 CDK Token 而非字面值。
- **置信度**：0.5
- **最近引用**：CR-005（2026-02-28，测试修复 5 个断言）
- **验证次数**：1
- **状态**：Active
- **冲突对**：无
- **日期**：2026-02-28

---

### AWS_REGION 环境变量优先级高于 AWS CLI 配置

- **类型**：防御
- **来源**：部署验证（首次 cdk deploy 失败）
- **标签**：AWS、CDK、环境变量、部署
- **描述**：`AWS_REGION` 环境变量的优先级高于 `aws configure` 配置文件中的 region 设置。CDK 通过 AWS SDK 解析区域时，如果 shell 环境中存在 `AWS_REGION=us-west-2`，即使 `aws configure get region` 返回 `us-east-1`，CDK 仍会部署到 us-west-2。部署命令中必须显式设置 `AWS_REGION=<target-region>` 来覆盖。
- **置信度**：0.8
- **最近引用**：部署验证（2026-02-28，首次 deploy 区域错误 → 修复）
- **验证次数**：1
- **状态**：Active
- **冲突对**：无
- **日期**：2026-02-28

---

### OpenClaw 无公开预构建 Docker 镜像

- **类型**：防御
- **来源**：部署验证（ghcr.io pull denied）
- **标签**：OpenClaw、Docker、部署
- **描述**：OpenClaw 没有公开的预构建 Docker 镜像（`ghcr.io/openclaw-ai/openclaw:latest` 不存在）。部署时必须从源码 `git clone + docker build` 构建 `openclaw:local` 镜像。构建约需 3-5 分钟（t3.medium）。User Data 中应使用自定义 docker-compose.yml 而非官方的（后者依赖大量环境变量和交互式 setup）。
- **置信度**：0.8
- **最近引用**：部署验证（2026-02-28，镜像拉取失败 → 改为源码构建）
- **验证次数**：1
- **状态**：Active
- **冲突对**：无
- **日期**：2026-02-28

---

### OpenClaw Gateway 配置文件必须预创建

- **类型**：防御
- **来源**：部署验证（gateway.mode + allowedOrigins 缺失导致容器循环重启）
- **标签**：OpenClaw、Docker、配置、部署
- **描述**：OpenClaw Gateway 启动前必须存在 `openclaw.json` 配置文件，包含 `gateway.mode=local` 和 `controlUi.allowedOrigins`。在自动化部署中，通过 `docker compose run` 执行 CLI 设置配置存在复杂的引号嵌套问题。最可靠的方式是：使用 bind mount 替代 named volume，在主机上预创建 `/home/ubuntu/openclaw/config/openclaw.json`，容器启动时直接读取。配置文件的所有者必须是 UID 1000（容器内 node 用户）。
- **置信度**：0.8
- **最近引用**：部署验证（2026-02-28，3 次迭代修复）
- **验证次数**：1
- **状态**：Active
- **冲突对**：无
- **日期**：2026-02-28

---

## Dormant

<!-- 休眠经验：置信度 < 0.4 或超 180 天未引用 -->

## Archived

<!-- 已归档：Dormant 超 360 天且验证次数 = 0 -->
