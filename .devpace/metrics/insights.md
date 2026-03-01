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

### Ubuntu UFW 默认 FORWARD 策略阻止 Docker 端口映射

- **类型**：防御
- **来源**：生产部署验证（Docker 端口外部不可达）
- **标签**：Ubuntu、Docker、UFW、iptables、网络
- **描述**：Ubuntu 24.04 的 UFW 默认 `DEFAULT_FORWARD_POLICY="DROP"`，会阻止 Docker 的端口映射流量。Docker 端口映射依赖 iptables FORWARD 链（通过 PREROUTING DNAT + FORWARD 转发），但 UFW 的 FORWARD DROP 策略会拦截新的入站连接。修复方法：在 `/etc/default/ufw` 中将 `DEFAULT_FORWARD_POLICY` 改为 `"ACCEPT"`，然后 `ufw reload` + `systemctl restart docker`。此修复应在 User Data 脚本中固化。
- **置信度**：0.8
- **最近引用**：生产部署（2026-02-28，手动修复后端口可达）
- **验证次数**：1
- **状态**：Active
- **冲突对**：无
- **日期**：2026-02-28

---

### 基础设施代码系统化优化策略

- **类型**：模式
- **来源**：自动提取（CR-006 merged）
- **标签**：CDK、代码质量、测试、工具链、ESLint、Prettier、Nag
- **描述**：infra 代码质量提升采用多维度同步优化策略更高效：(1) 删除死代码和统一命名规范；(2) 集成 ESLint + Prettier + CDK Nag 三重质量门；(3) 补全所有 construct 单元测试；(4) 一次性 PR 完成避免多次提交噪声。关键是先清理技术债（死代码），再建立规范（工具链），最后补全验证（测试），每步独立可验证保证中间状态可回退。
- **置信度**：0.5
- **最近引用**：CR-006（2026-03-01，L 级复杂度优化）
- **验证次数**：1
- **状态**：Active
- **冲突对**：无
- **日期**：2026-03-01

---

### 真实环境部署验证暴露 IaC 与上游实际的差异

- **类型**：防御
- **来源**：自动提取（CR-007 in_review，REL-002 部署验证发现）
- **标签**：部署、ALB、Target Group、端口、OpenClaw、验证
- **描述**：IaC 基于文档或假设定义的资源配置可能与上游实际实现不一致。REL-001 直连模式部署未触发问题，REL-002 首次 ALB 模式真实环境验证才暴露 OpenClaw 上游将 Control UI 从独立端口 (18790) 合并到 Gateway 端口 (18789)，导致 ALB Target Group 端口配置错误。防御价值：(1) 首次启用新架构模式（如 ALB vs 直连）时必须真实环境验证；(2) 上游服务端口/配置变更难以从文档获知，运行时验证不可替代；(3) 健康检查失败（502/unhealthy）是端口不匹配的典型信号。
- **置信度**：0.5
- **最近引用**：CR-007（2026-03-01，REL-002 部署验证）
- **验证次数**：1
- **状态**：Active
- **冲突对**：无
- **日期**：2026-03-01

---

### devpace 外部工具同步完整集成流程

- **类型**：模式
- **来源**：自动提取（pace-sync setup + create + push 完整流程）
- **标签**：devpace、同步、GitHub、Issues、集成、自动化
- **描述**：devpace 与 GitHub Issues 同步集成的完整流程：(1) setup 引导配置（平台识别、连接验证、标签预创建）；(2) create 批量从 CR 元数据生成 Issues（标题、意图、验收条件、关联功能）；(3) 根据 CR 状态设置 Issues 状态（released → closed + done + released 标签，in_review → awaiting-approval 标签）；(4) push 推送语义 Comment（状态转换上下文、关键交付摘要、PR 链接）。关键价值：外部协作层自动同步减少手动维护，语义 Comment 提供上下文而非仅状态变更通知。
- **置信度**：0.5
- **最近引用**：pace-sync（2026-03-01，7 CR → 7 Issues 同步）
- **验证次数**：1
- **状态**：Active
- **冲突对**：无
- **日期**：2026-03-01

---

### OpenClaw ALB 集成的三要素配置

- **类型**：防御
- **来源**：手动沉淀（CR-008 defect 解决链）
- **标签**：OpenClaw、ALB、CORS、代理、配置、部署
- **描述**：OpenClaw Gateway 与 ALB 集成需要完整的三要素配置才能正常工作：(1) **allowedOrigins**：动态注入 ALB DNS 地址到 `controlUi.allowedOrigins`，解决 CORS 错误（OpenClaw 不支持通配符 "*"）；(2) **dangerouslyDisableDeviceAuth**：设置 `controlUi.dangerouslyDisableDeviceAuth: true`，跳过设备配对流程（ALB+WAF+SG 已提供安全保护）；(3) **trustedProxies**：配置 `gateway.trustedProxies: [VPC_CIDR]`，使 OpenClaw 信任 ALB 的 X-Forwarded-For 头，避免 "device identity required" 错误。三者缺一不可，顺序无关。配置通过 user-data 脚本在容器启动前动态注入，自动重启生效。
- **置信度**：0.8
- **最近引用**：CR-008（2026-03-01，5 步问题解决链完整修复）
- **验证次数**：1
- **状态**：Active
- **冲突对**：与 "OpenClaw Gateway 首次启动三步配置" 部分重叠（ALB 模式下设备配对步骤被 dangerouslyDisableDeviceAuth 替代）
- **日期**：2026-03-01

---

### WebCrypto API 安全上下文的替代解决方案

- **类型**：模式
- **来源**：手动沉淀（CR-008 defect HTTPS 自签证书路径）
- **标签**：WebCrypto、HTTPS、安全、浏览器、企业部署
- **描述**：OpenClaw Control UI 使用 WebCrypto API 要求安全上下文（Secure Context）。企业部署场景下有两种解决方案：(1) **HTTPS + CA 签发证书**（最佳实践）：通过 ACM 导入或 Let's Encrypt 签发证书，浏览器无警告；(2) **HTTPS + 自签证书**：快速验证方案，浏览器会显示安全警告需手动信任；(3) **dangerouslyDisableDeviceAuth + HTTP**：当 ALB+WAF+SG 提供安全保护时，可禁用设备身份验证，此时 HTTP 即可满足（WebCrypto 不再需要）。关键洞察：dangerouslyDisableDeviceAuth 不仅跳过配对，还消除了对 HTTPS 的硬性依赖。
- **置信度**：0.7
- **最近引用**：CR-008（2026-03-01，选择方案 3 避免证书管理复杂度）
- **验证次数**：1
- **状态**：Active
- **冲突对**：无
- **日期**：2026-03-01

---

### CloudFormation Listener 替换冲突与运行时模式切换

- **类型**：防御
- **来源**：手动沉淀（CR-008 defect HTTP→HTTPS 切换失败）
- **标签**：CloudFormation、ALB、Listener、部署、CDK
- **描述**：CloudFormation 在替换 ALB Listener 时无法自动处理端口冲突：当从 HTTPS 模式（443 + 80→443 重定向）切换到 HTTP 模式（仅 80）时，CDK 会尝试删除 HTTPS Listener 并创建新的 HTTP 80 Listener，但 80 端口的重定向 Listener 已存在，导致 "A listener already exists on port 80" 错误。解决方案：(1) **通过 CDK context 参数控制模式**（推荐）：首次部署时确定模式，避免运行时切换；(2) **手动清理 Listener**：删除端口冲突的 Listener 再重新部署；(3) **使用 cdk destroy + deploy**：完全重建 Stack（生产环境慎用）。根本原因是 CloudFormation 的声明式替换无法处理端口级别的资源冲突。
- **置信度**：0.6
- **最近引用**：CR-008（2026-03-01，HTTP→HTTPS 切换失败，最终选择保持 HTTPS）
- **验证次数**：1
- **状态**：Active
- **冲突对**：无
- **日期**：2026-03-01

---

### 从临时修复到代码持久化的部署保证

- **类型**：模式
- **来源**：手动沉淀（CR-008 defect 完整解决方案验证）
- **标签**：部署、持久化、IaC、SSM、用户数据、最佳实践
- **描述**：生产问题的临时修复（如通过 SSM 手动修改配置文件）不能保证在新部署时自动生效，必须将修复固化到基础设施代码中。CR-008 的修复路径：(1) **临时验证**：通过 SSM `aws ssm send-command` 手动修改 `openclaw.json` 验证修复有效性；(2) **代码固化**：将修复逻辑嵌入到 CDK user-data 脚本（`clawforce-stack.ts` 的 python3 heredoc），在 EC2 启动时自动注入配置；(3) **资产模板化**：更新 `assets/openclaw.json` 和 `assets/docker-compose.yml`，确保配置模板包含所有必需字段；(4) **部署验证**：在全新环境重新 `cdk deploy` 验证问题不再出现。关键价值：避免 "works on my machine" 陷阱，确保 Infrastructure as Code 的幂等性和可重复性。
- **置信度**：0.8
- **最近引用**：CR-008（2026-03-01，5 个问题全部通过代码固化解决）
- **验证次数**：1
- **状态**：Active
- **冲突对**：无
- **日期**：2026-03-01

---

## Dormant

<!-- 休眠经验：置信度 < 0.4 或超 180 天未引用 -->

## Archived

<!-- 已归档：Dormant 超 360 天且验证次数 = 0 -->
