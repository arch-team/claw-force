# 测试规范

> **职责**: 定义 TDD 工作流、覆盖率要求、Fine-grained Assertions 和 CDK Nag 合规测试规范。

> Claude 生成 CDK 测试代码时优先查阅此文档

本项目全面采用测试驱动开发 (TDD)。

---

## 0. 速查卡片

### TDD 核心循环

```
1. 🔴 Red: 先写失败的测试
2. 🟢 Green: 编写最少代码使测试通过
3. 🔄 Refactor: 重构代码，保持测试通过
```

**测试诚信原则**: 切勿为让测试通过而伪造结果。测试失败 = 代码有问题，必须修复代码。

### 覆盖率要求

| 层级 | 最低覆盖率 | 目标覆盖率 |
|------|-----------|-----------|
| Constructs | 90% | 95% |
| Stacks | 85% | 90% |
| **整体** | **85%** | **90%** |

### 命令

```bash
pnpm test                              # 运行所有测试
pnpm test:coverage                     # 测试 + 覆盖率
pnpm test -- -u                        # 更新快照
pnpm test test/snapshot/main.test.ts   # 运行特定测试
```

### 测试类型

| 类型 | 用途 | 工具 |
|------|------|------|
| **Fine-grained** | 验证特定资源属性 | CDK Assertions |
| **Snapshot** | 检测意外变更 | Jest Snapshot |
| **Compliance** | 安全合规检查 | CDK Nag |

### CDK Assertions API

```typescript
// 资源断言
template.hasResourceProperties('AWS::S3::Bucket', { ... });
template.resourceCountIs('AWS::Lambda::Function', 2);
template.hasOutput('VpcId', { ... });

// Match 匹配器
Match.objectLike({ ... })    // 部分匹配
Match.exact({ ... })         // 精确匹配
Match.anyValue()             // 任意值
Match.absent()               // 属性不存在
Match.arrayWith([...])       // 数组包含
```

### 最佳实践

| ✅ 应该 | ❌ 避免 |
|--------|--------|
| 测试业务配置和安全属性 | 测试 CDK 内部实现 |
| beforeEach 独立创建 stack | 全局共享 stack 状态 |
| 验证关键安全属性 | 仅验证资源存在 |

---

## 1. Fine-grained Assertions

### 测试模板

```typescript
import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { VpcConstruct } from './vpc.construct';

describe('VpcConstruct', () => {
  let template: Template;

  beforeEach(() => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');
    new VpcConstruct(stack, 'TestVpc', { vpcCidr: '10.0.0.0/16' });
    template = Template.fromStack(stack);
  });

  it('should create VPC with correct CIDR', () => {
    template.hasResourceProperties('AWS::EC2::VPC', {
      CidrBlock: '10.0.0.0/16',
      EnableDnsHostnames: true,
    });
  });

  it('should create NAT Gateway when enabled', () => {
    template.resourceCountIs('AWS::EC2::NatGateway', 2);
  });
});
```

### 安全属性验证

```typescript
// S3 安全配置
template.hasResourceProperties('AWS::S3::Bucket', {
  PublicAccessBlockConfiguration: {
    BlockPublicAcls: true,
    BlockPublicPolicy: true,
  },
});

// RDS 安全配置
template.hasResourceProperties('AWS::RDS::DBCluster', {
  StorageEncrypted: true,
  DeletionProtection: true,
  PubliclyAccessible: Match.absent(),
});

// IAM 策略验证
template.hasResourceProperties('AWS::IAM::Policy', {
  PolicyDocument: {
    Statement: Match.arrayWith([
      Match.objectLike({ Action: Match.arrayWith(['s3:GetObject*']), Effect: 'Allow' }),
    ]),
  },
});
```

---

## 2. Snapshot 测试

```typescript
// test/snapshot/main.test.ts
describe('Snapshot Tests', () => {
  it('NetworkStack matches snapshot', () => {
    const app = new cdk.App();
    const stack = new NetworkStack(app, 'TestStack', {
      env: { account: '123456789012', region: 'ap-northeast-1' },  // 测试用占位符账户
      vpcCidr: '10.0.0.0/16',
    });

    expect(Template.fromStack(stack).toJSON()).toMatchSnapshot();
  });
});
```

---

## 3. CDK Nag 合规测试

```typescript
// test/compliance/cdk-nag.test.ts
import { Aspects } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';

describe('CDK Nag Compliance', () => {
  it('should pass AWS Solutions checks', () => {
    const app = new cdk.App();
    const stack = new NetworkStack(app, 'TestStack', { ... });

    Aspects.of(stack).add(new AwsSolutionsChecks({ verbose: true }));

    const messages = app.synth().getStackArtifact(stack.artifactId).messages;
    const errors = messages.filter((m) => m.level === 'error');

    expect(errors).toHaveLength(0);
  });
});
```

---

## 相关文档

- [project-structure.md](project-structure.md) - 测试文件位置
- [construct-design.md](construct-design.md) - Construct 设计模式
