# 技术栈规范 (Tech Stack Standards)

> **职责**: 技术栈版本要求的**单一真实源**，包括 AWS CDK、TypeScript、Node.js 等核心依赖版本。

---

## §0 速查卡片

### 版本要求矩阵

| 类别 | 技术 | 最低版本 | 推荐版本 |
|------|------|---------|---------|
| **核心** | AWS CDK | >=2.130.0 | 2.170.0+ |
| **核心** | TypeScript | >=5.0.0 | 5.4+ |
| **核心** | Node.js | >=18.0.0 | 22 LTS |
| **包管理** | pnpm | >=8.0.0 | 9.x |
| **测试** | Jest | >=29.0.0 | 29.7+ |
| **安全** | cdk-nag | >=2.28.0 | 2.30+ |
| **代码质量** | ESLint | >=8.0.0 | 9.x |
| **代码质量** | Prettier | >=3.0.0 | 3.x |

### 关键约束

- **包管理器**: 仅使用 pnpm，禁止 npm/yarn
- **Lambda 运行时**: nodejs22.x (Node.js 22 LTS)
- **TypeScript**: `strict: true` 必须启用

### 快速验证命令

```bash
# 检查核心版本
node -v && pnpm -v && pnpm exec tsc --version && pnpm exec cdk --version

# 检查依赖版本
pnpm list aws-cdk-lib jest cdk-nag
```

---

## 相关文档

| 文档 | 说明 |
|------|------|
| [CLAUDE.md](../CLAUDE.md) | 技术栈概述 |
| [testing.md](testing.md) | 测试规范 |
