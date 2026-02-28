# CDK 架构规范

> **职责**: 定义 CDK Construct 分层 (L1/L2/L3)、Stack 组合模式和跨 Stack 通信规范。

> Claude 生成 CDK 代码时优先查阅

**架构模式**: CDK Construct 分层 (L1 → L2 → L3)

---

## 0. 速查卡片

### Construct 层级

| 层级 | 描述 | 来源 | 示例 |
|------|------|------|------|
| **L1** | CloudFormation 直接映射 | `Cfn*` 前缀 | `CfnBucket` |
| **L2** | 高级抽象 + 合理默认值 | `aws-*` 模块 | `s3.Bucket` |
| **L3** | 业务组合，多资源协作 | 自定义 Construct | `VpcConstruct` |

**规则**: 优先 L2 → 需要组合时用 L3 → L2 不支持时才用 L1

### 依赖方向

```
App → Stack A → L3 → L2 → L1
         ↓
      Stack B (依赖 A 的输出)
```

**核心规则**:
- Stack 间通过 Props 或 Outputs 传递依赖
- Construct 内部从高层调用低层
- 禁止循环依赖

### Stack 组合模式

| 模式 | 适用场景 | 示例 |
|------|---------|------|
| 按资源类型 | 生命周期不同 | NetworkStack, DatabaseStack |
| 按环境 | 多环境部署 | dev-Stack, prod-Stack |
| 按服务 | 微服务架构 | AuthStack, AgentStack |

### Stack 职责划分

| Stack | 包含资源 |
|-------|---------|
| NetworkStack | VPC, Subnets, NAT |
| SecurityStack | Security Groups, WAF, KMS |
| DatabaseStack | RDS, DynamoDB, ElastiCache |
| ComputeStack | EKS, ECS, Lambda, EC2 |
| ApiStack | API Gateway, ALB |
| MonitoringStack | CloudWatch, SNS, Alarms |

---

## 1. Construct 分层使用

### L2 优先 (推荐)

```typescript
// ✅ L2: 合理默认值 + Grant 方法
const bucket = new s3.Bucket(this, 'DataBucket', {
  versioned: true,
  encryption: s3.BucketEncryption.S3_MANAGED,
});
bucket.grantRead(fn);  // Grant 方法授权
```

### L3 自定义 Construct

详见 [construct-design.md](construct-design.md) - Construct 设计规范

---

## 2. Stack 设计

### Stack Props 模式

```typescript
export interface ComputeStackProps extends cdk.StackProps {
  readonly vpc: ec2.IVpc;           // 必需依赖
  readonly instanceType?: ec2.InstanceType;  // 可选配置
}

export class ComputeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);
    const { vpc, instanceType = ec2.InstanceType.of(T3, SMALL) } = props;
  }
}
```

### Stack 间依赖

```typescript
// bin/app.ts
const networkStack = new NetworkStack(app, `Network-${env}`);
const computeStack = new ComputeStack(app, `Compute-${env}`, {
  vpc: networkStack.vpc,  // Props 传递
});
computeStack.addDependency(networkStack);  // 显式依赖
```

---

## 3. 跨 Stack 通信

### 决策矩阵

| 方式 | 适用场景 | 优点 | 缺点 |
|------|---------|------|------|
| **Props 传递** (首选) | 同一 App 内 Stack 间依赖 | 类型安全、重构友好 | 仅限同 App |
| **SSM Parameter** | 跨 App/跨团队共享配置 | 解耦部署、运行时查找 | 合成期延迟、需管理命名 |
| **CfnOutput** | 遗留系统集成 | CloudFormation 原生 | ⚠️ 创建删除顺序耦合，难以修改导出值 |

> **规则**: 优先 Props 传递 → 跨 App 用 SSM → 仅遗留集成用 CfnOutput

### 方式一：Props 传递 (首选)

```typescript
const computeStack = new ComputeStack(app, 'Compute', { vpc: networkStack.vpc });
```

### 方式二：SSM Parameter (跨 App 场景)

```typescript
// 写入 (Network Stack)
new ssm.StringParameter(this, 'VpcId', { parameterName: '/infra/vpc-id', stringValue: this.vpc.vpcId });

// 读取 (Compute Stack)
const vpcId = ssm.StringParameter.valueFromLookup(this, '/infra/vpc-id');
```

### 方式三：CfnOutput + Fn.importValue (不推荐新代码使用)

> ⚠️ `Fn.importValue` 会创建 Stack 间硬耦合：导出 Stack 无法修改导出值或删除，除非所有导入 Stack 先移除引用。

```typescript
// 导出
new cdk.CfnOutput(this, 'VpcId', { value: this.vpc.vpcId, exportName: 'NetworkVpcId' });

// 导入
const vpcId = cdk.Fn.importValue('NetworkVpcId');
```

---

## 4. 环境配置

> **职责边界**: 本节关注环境配置的**架构设计**（如何组织配置结构）。实际部署流程、环境矩阵、CI/CD 配置详见 [deployment.md](deployment.md)

### CDK Context 模式

```typescript
// lib/config/environments.ts
export interface EnvironmentConfig {
  readonly account: string;
  readonly region: string;
  readonly vpcCidr: string;
}

export function getEnvironmentConfig(app: cdk.App, envName: string): EnvironmentConfig {
  const config = app.node.tryGetContext('environments')?.[envName];
  if (!config) throw new Error(`未找到环境配置: ${envName}`);
  return config;
}
```

### 使用配置

```typescript
// bin/app.ts
const envName = app.node.tryGetContext('env') || 'dev';
const envConfig = getEnvironmentConfig(app, envName);

new NetworkStack(app, `Network-${envName}`, {
  env: { account: envConfig.account, region: envConfig.region },
  vpcCidr: envConfig.vpcCidr,
});
```

---

## 相关文档

- [project-structure.md](project-structure.md) - 目录结构规范
- [construct-design.md](construct-design.md) - Construct 设计规范
- [security.md](security.md) - 安全规范
- [testing.md](testing.md) - 测试规范
