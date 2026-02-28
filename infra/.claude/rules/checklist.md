# PR Review 检查清单

> **职责**: PR Review 检查清单的**单一真实源**，涵盖架构、设计、安全、测试、部署和成本检查项。

---

## 分层与架构

- [ ] 自定义 Construct 放在 `lib/constructs/`
- [ ] Stack 放在 `lib/stacks/`
- [ ] 新 Stack 已添加到 project-config.md 的 Stack 列表
- [ ] 没有跨 Stack 的直接资源引用
- [ ] Construct 依赖方向正确 (L3 → L2 → L1)

详见 [architecture.md](architecture.md)

---

## Construct 设计

- [ ] Props 使用 `readonly` 修饰
- [ ] 可选参数有合理默认值
- [ ] 暴露必要的公开属性
- [ ] 有 JSDoc 注释

详见 [construct-design.md](construct-design.md)

---

## 安全

- [ ] 使用 Grant 方法而非手动 IAM 策略
- [ ] 敏感信息存储在 Secrets Manager
- [ ] S3 Bucket 阻止公开访问
- [ ] RDS 在私有子网且加密
- [ ] CDK Nag 检查通过
- [ ] 没有 `actions: ['*']` 或 `resources: ['*']`

详见 [security.md](security.md)

---

## 测试

- [ ] 每个 Construct 有对应测试
- [ ] 关键属性有 Fine-grained 断言
- [ ] Snapshot 测试检测意外变更
- [ ] 覆盖率达标 (≥85%)

详见 [testing.md](testing.md)

---

## 部署

- [ ] 环境配置使用 CDK Context
- [ ] 有适当的 RemovalPolicy
- [ ] `cdk diff` 确认变更
- [ ] 有回滚计划

详见 [deployment.md](deployment.md)

---

## 成本

- [ ] 所有资源有成本标签
- [ ] Dev 环境使用最小规格
- [ ] S3 有生命周期规则

详见 [cost-optimization.md](cost-optimization.md)

---

## 项目结构

- [ ] 测试与源码在对应目录
- [ ] 无硬编码的账户或区域
- [ ] cdk.context.json 未被提交

详见 [project-structure.md](project-structure.md)

---

## 预提交一键验证

完整验证命令见 [CLAUDE.md §PR Review 检查清单](../CLAUDE.md#pr-review-检查清单)
