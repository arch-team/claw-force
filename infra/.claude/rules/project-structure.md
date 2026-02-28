# 项目目录结构规范 (Project Structure)

> **职责**: 定义 infra 项目的目录结构、配置文件用途和新项目初始化检查清单。

> Claude 初始化或检查项目结构时优先查阅此文档

---

## 0. 速查卡片

### Infra 目录结构 ← 当前位置

```
infra/                          # CDK 项目根目录
├── .claude/                    # Claude Code 上下文 (规范文档)
│   ├── CLAUDE.md               # 基础设施入口
│   ├── project-config*.md
│   └── rules/                  # Infra 专用规则
├── bin/                        # CDK 应用入口
│   └── app.ts
├── lib/                        # 源代码
│   ├── constructs/             # 自定义 L3 Construct
│   │   ├── vpc/
│   │   │   ├── index.ts
│   │   │   ├── vpc.construct.ts
│   │   │   └── vpc.construct.test.ts
│   │   ├── aurora/
│   │   └── api-gateway/
│   ├── stacks/                 # Stack 定义
│   │   ├── network-stack.ts
│   │   ├── compute-stack.ts
│   │   └── api-stack.ts
│   └── config/                 # 配置和常量
│       ├── environments.ts
│       └── constants.ts
├── test/                       # 集成测试
│   ├── snapshot/               # 快照测试
│   └── compliance/             # CDK Nag 合规测试
├── cdk.json                    # CDK 配置
├── cdk.context.json            # CDK 上下文缓存 (git ignore)
├── jest.config.js              # Jest 配置
├── package.json                # 项目配置
├── pnpm-lock.yaml              # 依赖锁定
├── tsconfig.json               # TypeScript 配置
└── README.md                   # 基础设施说明
```

### 配置文件速查

| 文件 | 用途 | 必须 |
|------|------|:----:|
| `cdk.json` | CDK 应用配置 | ✅ |
| `package.json` | 项目和脚本配置 | ✅ |
| `tsconfig.json` | TypeScript 配置 | ✅ |
| `jest.config.js` | Jest 测试配置 | ✅ |
| `.eslintrc.cjs` | ESLint 配置 | 推荐 |
| `README.md` | 项目说明 | ✅ |

### 命名规范

| 类型 | 命名 | 示例 |
|------|------|------|
| Construct 目录 | `kebab-case` | `api-gateway/` |
| Construct 文件 | `{name}.construct.ts` | `vpc.construct.ts` |
| Construct 测试 | `{name}.construct.test.ts` | `vpc.construct.test.ts` |
| Stack 文件 | `{name}-stack.ts` | `network-stack.ts` |
| Construct 类名 | `PascalCase` + `Construct` | `VpcConstruct` |
| Stack 类名 | `PascalCase` + `Stack` | `NetworkStack` |

### 禁止事项

| 规则 | 说明 |
|------|------|
| ❌ bin/ 中放业务逻辑 | bin/app.ts 只做 Stack 组装 |
| ❌ Stack 中直接写资源 | 复杂资源应封装为 Construct |
| ❌ 硬编码账户/区域 | 使用 CDK Context 管理 |
| ❌ cdk.context.json 入版本控制 | 应在 .gitignore 中 |

---

## 1. cdk.json 关键配置

```json
{
  "app": "npx ts-node --prefer-ts-exts bin/app.ts",
  "context": {
    "@aws-cdk/core:newStyleStackSynthesis": true,
    "@aws-cdk/aws-rds:lowercaseDbIdentifier": true,
    "environments": {
      "dev": { "account": "<YOUR_DEV_ACCOUNT_ID>", "region": "ap-northeast-1" },
      "prod": { "account": "<YOUR_PROD_ACCOUNT_ID>", "region": "ap-northeast-1" }
    }
  }
}
```

> **注意**: `<YOUR_*_ACCOUNT_ID>` 为占位符，实际值请参考 [project-config.md](../project-config.md) 中的环境配置。禁止将真实账户 ID 提交到公开仓库。

**关键点**: `environments` 在 context 中定义，通过 `app.node.tryGetContext('env')` 读取

---

## 2. 新项目初始化检查清单

### 目录
- [ ] `bin/app.ts` 存在且为可执行
- [ ] `lib/constructs/` 和 `lib/stacks/` 已创建
- [ ] `lib/config/environments.ts` 已配置
- [ ] `.claude/CLAUDE.md` 已配置

### 配置文件
- [ ] `cdk.json` 包含应用入口和 context
- [ ] `package.json` 包含所有必要脚本
- [ ] `tsconfig.json` 配置正确
- [ ] `jest.config.js` 配置测试
- [ ] `README.md` 包含项目说明

### Git 配置
- [ ] `.gitignore` 包含 `cdk.context.json`
- [ ] `.gitignore` 包含 `cdk.out/`
- [ ] `.gitignore` 包含 `node_modules/`
