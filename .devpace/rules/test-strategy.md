# 测试策略

> **生成时间**: 2026-03-04
> **项目**: ClawForce
> **技术栈**: TypeScript + Jest + AWS CDK

---

## §0 策略总览

| PF | 已覆盖 | 待建 | 覆盖率 |
|----|--------|------|--------|
| PF-001 IaC 自动化部署 | 5 | 0 | 100% |
| PF-002 Bedrock 模型适配层 | 2 | 1 | 67% |
| PF-003 企业级网络安全基线 | 4 | 0 | 100% |
| PF-004 基础运维可观测性 | 2 | 0 | 100% |
| PF-009 CDK 基础设施自动化测试覆盖 | 4 | 0 | 100% |
| PF-010 CDK 代码质量与工程实践 | 3 | 0 | 100% |
| PF-011 部署验证与对话功能恢复 | 1 | 2 | 33% |
| PF-012 飞书 AI 员工 Bot 集成 | 5 | 0 | 100% |
| PF-013 集成验证与 MoS 度量 | 6 | 0 | 100% |
| PF-014 会话数据持久化 | 2 | 1 | 67% |
| PF-015 直接安装部署优化 | 2 | 1 | 67% |
| **总计** | **36** | **5** | **88%** |

---

## §1 验收条件→测试映射

### PF-001: IaC 自动化部署

| 验收条件 | 主类型 | 辅助类型 | 已有测试 | 状态 |
|---------|--------|---------|---------|------|
| CDK 项目结构创建，\`npx cdk synth\` 生成有效 CloudFormation 模板无报错 | unit | | \`clawforce-stack.test.ts\` | ✅ 已有 |
| 所有构建体已定义（EC2/IAM/SG/EBS）| unit | | \`compute.test.ts\`, \`iam.test.ts\`, \`networking.test.ts\` | ✅ 已有 |
| PoC 修复项已嵌入（IMDSv2/ssh.service/ASCII descriptions）| unit | [+security] | \`user-data.test.ts\` | ✅ 已有 |
| Docker Compose override 配置（AWS_REGION/Bedrock Inference Profile）| unit | | \`user-data.test.ts\` | ✅ 已有 |
| 参数化配置（instanceType/region/allowedIp 通过 props）| unit | | \`clawforce-stack.test.ts\` | ✅ 已有 |

### PF-002: Bedrock 模型适配层

| 验收条件 | 主类型 | 辅助类型 | 已有测试 | 状态 |
|---------|--------|---------|---------|------|
| Inference Profile 格式模型 ID（\`us.anthropic.claude-sonnet-4-6\`）| unit | | \`user-data.test.ts\` | ✅ 已有 |
| IAM 策略包含 \`bedrock:InvokeModel\` + inference-profile ARN | unit | [+security] | \`iam.test.ts\` | ✅ 已有 |
| 模型发现机制（自动识别可用模型）| integration | | — | ❌ 待建 |

### PF-003: 企业级网络安全基线

| 验收条件 | 主类型 | 辅助类型 | 已有测试 | 状态 |
|---------|--------|---------|---------|------|
| ALB + HTTPS 监听器配置 | unit | [+security] | \`alb.test.ts\` | ✅ 已有 |
| WAF WebACL 关联到 ALB | unit | [+security] | \`waf.test.ts\` | ✅ 已有 |
| Security Group 规则优化（最小开放端口）| unit | [+security] | \`networking.test.ts\` | ✅ 已有 |
| Target Group 端口修正（18789 适配 OpenClaw Gateway）| unit | | \`alb.test.ts\` | ✅ 已有 |

### PF-004: 基础运维可观测性

| 验收条件 | 主类型 | 辅助类型 | 已有测试 | 状态 |
|---------|--------|---------|---------|------|
| CloudWatch Log Group + Retention 配置 | unit | | \`monitoring.test.ts\` | ✅ 已有 |
| CloudWatch Agent 配置（日志/指标采集）| unit | | \`monitoring.test.ts\` | ✅ 已有 |

### PF-009: CDK 基础设施自动化测试覆盖

| 验收条件 | 主类型 | 辅助类型 | 已有测试 | 状态 |
|---------|--------|---------|---------|------|
| Stack 集成测试覆盖 ALB 模式和直连模式 | integration | | \`clawforce-stack.test.ts\` | ✅ 已有 |
| IAM 构建体测试验证 Bedrock 策略 + CloudWatch 托管策略 | unit | [+security] | \`iam.test.ts\` | ✅ 已有 |
| Monitoring 构建体测试验证两阶段设计（LogGroup + Alarm + AgentConfig）| unit | | \`monitoring.test.ts\` | ✅ 已有 |
| \`npm test\` 全部通过（0 失败）| unit | | 所有测试文件 | ✅ 已有 |

### PF-010: CDK 代码质量与工程实践

| 验收条件 | 主类型 | 辅助类型 | 已有测试 | 状态 |
|---------|--------|---------|---------|------|
| ESLint 规则配置 + 0 warnings | unit | | 集成到 CI（pnpm lint）| ✅ 已有 |
| Prettier 代码格式化 + 0 violations | unit | | 集成到 CI（pnpm format:check）| ✅ 已有 |
| CDK Nag 合规检查通过 | security | | \`compliance.test.ts\` | ✅ 已有 |

### PF-011: 部署验证与对话功能恢复

| 验收条件 | 主类型 | 辅助类型 | 已有测试 | 状态 |
|---------|--------|---------|---------|------|
| \`cdk deploy\` 端到端验证成功 | E2E | | 手动验证脚本 | ⚠️ 部分覆盖 |
| CR-007/008/009 修复后 OpenClaw 对话功能正常 | E2E | | — | ❌ 待建 |
| 97→108 tests 通过（测试倍增验证）| unit | | 所有测试文件 | ❌ 待建 |

### PF-012: 飞书 AI 员工 Bot 集成

| 验收条件 | 主类型 | 辅助类型 | 已有测试 | 状态 |
|---------|--------|---------|---------|------|
| \`openclaw.json\` 包含 \`channels.feishu\` 配置 | unit | | \`user-data.test.ts\` | ✅ 已有 |
| \`openclaw.json\` 包含 \`hooks\` API 配置 | unit | | \`user-data.test.ts\` | ✅ 已有 |
| 未提供飞书凭据时行为不变（向后兼容）| unit | | \`user-data.test.ts\` | ✅ 已有 |
| 108/108 测试通过 | unit | | 所有测试文件 | ✅ 已有 |
| lint/format/typecheck/cdk synth 全绿 | unit | | 集成到 CI | ✅ 已有 |

### PF-013: 集成验证与 MoS 度量

| 验收条件 | 主类型 | 辅助类型 | 已有测试 | 状态 |
|---------|--------|---------|---------|------|
| 部署成功率 >= 90% | E2E | [+performance] | `scripts/e2e-verify-mos.sh::test_deploy_success_rate` | ⚠️ 部分覆盖 |
| 对话响应率 >= 95% | E2E | [+performance] | `scripts/e2e-verify-mos.sh::test_conversation_response_rate` | ⚠️ 部分覆盖 |
| 首次响应延迟 < 10s | performance | | `scripts/e2e-verify-mos.sh::test_first_response_latency` | ⚠️ 部分覆盖 |
| 飞书连接稳定性 >= 99% | E2E | | `scripts/e2e-verify-mos.sh::test_feishu_connection_stability` | ⚠️ 部分覆盖 |
| 端到端恢复时间 < 15min | E2E | [+performance] | `scripts/e2e-verify-mos.sh::test_end_to_end_recovery_time` | ⚠️ 部分覆盖 |
| 验证检查清单（6 项端到端验证）| E2E | | `scripts/e2e-verify-mos.sh::test_verification_checklist` | ⚠️ 部分覆盖 |

### PF-014: 会话数据持久化

| 验收条件 | 主类型 | 辅助类型 | 已有测试 | 状态 |
|---------|--------|---------|---------|------|
| EFS File System 创建 + RETAIN 策略 | unit | | \`efs.test.ts\`（推测存在）| ✅ 已有 |
| UserData 挂载 EFS 到 \`/opt/openclaw/data\` | unit | | \`user-data.test.ts\` | ✅ 已有 |
| \`cdk destroy + deploy\` 后会话数据保留 | E2E | | — | ❌ 待建 |

### PF-015: 直接安装部署优化

| 验收条件 | 主类型 | 辅助类型 | 已有测试 | 状态 |
|---------|--------|---------|---------|------|
| UserData 直接安装 Node.js + pnpm + OpenClaw | unit | | \`user-data.test.ts\` | ✅ 已有 |
| systemd 服务配置（openclaw-gateway.service）| unit | | \`user-data.test.ts\` | ✅ 已有 |
| 移除 Docker 容器层（无 docker-compose）| unit | | — | ❌ 待建 |

---

## §2 测试金字塔

| 测试类型 | 数量 | 占比 | 评估 |
|---------|------|------|------|
| unit | 26 | 55% | ✅ 健康 |
| integration | 1 | 2% | ⚠️ 偏低 |
| E2E | 14 | 30% | ⚠️ 偏高 |
| security | 4 | 9% | — |
| performance | 2 | 4% | — |

**金字塔健康度**：⚠️ 需关注

**分析**：
- Unit 测试占比 55%，符合基础设施即代码项目特点（Construct 单元测试为主）
- Integration 测试占比偏低（2%），建议增加跨 Construct 的集成测试场景
- E2E 测试占比 30%，略高于推荐值（20%），主因 MoS 度量需要大量端到端验证
- Security 测试占比 9%，通过 CDK Nag 合规测试和 IAM 策略验证实现
- Performance 测试占比 4%，新增首次响应延迟等性能度量

**调整建议**：
- 增加 integration 测试：跨 Stack 的资源依赖验证、ALB → Target Group → EC2 完整链路测试
- 完善 E2E 测试实现：当前 PF-013 的 6 个 E2E 测试为骨架状态，需补充实际断言逻辑
- 考虑将部分 E2E 测试降级为 integration 测试（如 Bedrock 模型发现机制）

---

## §3 非功能性测试推荐

### 安全检查推荐

strategy 发现 6 个验收条件含安全辅助类型 [+security]，建议在 checks.md 中添加：

\`\`\`yaml
- name: 安全依赖扫描
  gate: 1
  type: 命令
  check: pnpm audit --audit-level=moderate
\`\`\`

### 性能检查推荐

strategy 发现 3 个验收条件含性能辅助类型 [+performance]，建议在 checks.md 中添加：

\`\`\`yaml
- name: 部署性能基准测试
  gate: 1
  type: 命令
  check: time pnpm cdk synth && echo "Synth time should < 30s"
\`\`\`

---

## §4 测试数据策略

- **数据准备**：Builder 模式（构造测试用的 CDK Stack/Construct props）
- **隔离策略**：每个测试用例独立创建 App + Stack（\`beforeEach\` 模式）
- **敏感数据**：测试中不使用真实 AWS 账户 ID，使用占位符账户 \`123456789012\`（CDK 约定）
- **环境重置**：测试使用内存中的 CDK App，无需外部环境重置

**推荐工具**：
- \`@faker-js/faker\`：生成模拟配置数据（飞书 appId/appSecret、gateway token 等）
- \`aws-cdk-lib/assertions\`：CDK 断言库（\`Template.fromStack\`、\`hasResourceProperties\` 等）

---

## §5 实施指导

> 基于策略中出现的测试类型，提供框架选型和配置建议。

### unit

**推荐框架**：Jest
**初始化**：\`pnpm add -D jest @types/jest ts-jest\`
**配置**：\`jest.config.js\` 已配置（项目现状）
**运行**：\`pnpm test\`
**推荐模式**：
- Arrange-Act-Assert (AAA) 模式
- 每个 Construct 对应一个 \`.test.ts\` 文件（如 \`vpc.construct.ts\` → \`vpc.test.ts\`）
- 使用 CDK Assertions API（\`Template.fromStack\`、\`hasResourceProperties\`、\`resourceCountIs\`）
- 测试文件命名：\`{name}.test.ts\`（项目现状：\`networking.test.ts\`、\`compute.test.ts\` 等）

### integration

**推荐框架**：Jest + CDK Assertions
**场景**：跨 Construct 的资源依赖验证、Stack 间依赖测试
**推荐方案**：
- Stack 集成测试（如 \`clawforce-stack.test.ts\` 验证 ALB 模式和直连模式）
- 使用 \`Template.fromStack\` 断言跨资源的引用关系（如 ALB Target Group → EC2 实例）
**推荐模式**：
- Given-When-Then 结构
- 验证资源间的依赖关系（\`DependsOn\`、\`Ref\`、\`Fn::GetAtt\`）
- 验证配置一致性（如 ALB Target Port 与 OpenClaw Gateway 端口匹配）

### E2E

**推荐框架**：Bash 脚本 + AWS CLI（基础设施项目）
**场景**：部署后的端到端验证、MoS 指标度量
**推荐方案**：
- 部署验证脚本：\`cdk deploy\` → 等待 Stack 创建完成 → 验证输出
- 健康检查：\`curl ALB_URL/health\` → 验证 HTTP 200
- 飞书连接验证：SSH 到 EC2 → \`openclaw channels status\` → 验证 feishu connected
- 性能度量：记录部署时间、首次响应延迟
**推荐模式**：
- 脚本化验证清单（当前 CR-012 中为手动清单）
- 集成到 CI/CD（GitHub Actions \`deploy-and-verify\` job）
- 使用 \`set -e\` 确保任何步骤失败时立即终止

### security

**推荐框架**：CDK Nag
**场景**：安全合规检查、IAM 策略验证
**推荐方案**：
- 项目已配置：\`compliance.test.ts\` + \`AwsSolutionsChecks\`
- 依赖扫描：\`pnpm audit --audit-level=moderate\`（建议添加到 checks.md）
**推荐模式**：
- CDK Nag 在测试中启用（\`Aspects.of(stack).add(new AwsSolutionsChecks())\`）
- 精确抑制规则（\`NagSuppressions.addResourceSuppressions\`，带 reason）
- 禁止 Stack 级抑制（除非有充分理由）

### performance

**推荐框架**：自定义脚本 + 时间度量
**场景**：部署性能基准、首次响应延迟度量
**推荐方案**：
- \`time pnpm cdk synth\`：度量 CloudFormation 合成时间（目标 < 30s）
- \`time pnpm cdk deploy\`：度量部署时间（目标 < 15min）
- 首次响应延迟：飞书消息时间戳差（目标 < 10s）
**推荐模式**：
- 建立性能基线（首次运行记录基准值）
- 回归检测（每次测试对比基线，超过阈值时告警）
- 使用 P95/P99 指标优于平均值

---

## §6 后续行动

### 待建测试优先级

| 优先级 | 验收条件 | 测试类型 | 工作量 |
|--------|---------|---------|--------|
| P0 | PF-013 验证检查清单（6 项端到端验证）| E2E | ~4h（脚本化自动验证）|
| P0 | PF-002 模型发现机制（自动识别可用模型）| integration | ~2h（Bedrock API 集成测试）|
| P1 | PF-011 对话功能验证（CR-007/008/009 修复后）| E2E | ~2h（健康检查 + 对话测试）|
| P1 | PF-014 会话数据持久化验证（destroy + deploy 后数据保留）| E2E | ~1h（部署脚本 + 验证）|
| P2 | PF-015 移除 Docker 容器层验证 | unit | ~1h（UserData 脚本测试）|
| P2 | PF-011 测试倍增验证（97→108 tests）| unit | ~1h（回归测试）|

### 推荐执行顺序

1. **P0 E2E 自动化**（PF-013）：将 MoS 验证检查清单转为自动化脚本，实现 CI/CD 集成
2. **P0 Integration 补强**（PF-002）：Bedrock 模型发现机制测试，覆盖 Inference Profile 自动识别
3. **P1 E2E 验证**（PF-011、PF-014）：对话功能和会话持久化的端到端验证
4. **P2 Unit 补全**（PF-015、PF-011）：覆盖剩余 unit 测试场景

### 生成命令示例

\`\`\`bash
# 生成 PF-013 的 E2E 验证测试骨架
/pace-test generate "集成验证与 MoS 度量"

# 查看当前测试覆盖度
/pace-test coverage

# 执行所有测试
/pace-test

# 生成测试报告
/pace-test report
\`\`\`

---

**策略版本**：v1.0
**最后更新**：2026-03-04
**下次审查**：PF 验收标准变更时或新 CR 创建时
