# Construct 设计规范

> **职责**: 定义 Construct 的 Props 接口设计、实现模式、安全默认配置和 JSDoc 注释规范。

> Claude 生成 CDK Construct 代码时优先查阅

---

## 0. 速查卡片

### Props 设计

| 规则 | ✅ 正确 | ❌ 错误 |
|------|--------|--------|
| readonly 修饰 | `readonly vpcCidr: string` | `vpcCidr: string` |
| 可选参数 | `readonly timeout?: number` | `readonly timeout: number \| undefined` |
| 默认值 | 解构时设置 | Props 接口中设置 |
| 接口命名 | `{Construct}Props` | `{Construct}Options` |

### Construct 模板

```typescript
export interface {Construct}Props {
  readonly requiredProp: string;
  readonly optionalProp?: number;
}

/**
 * {描述} Construct - 一句话说明用途。
 * @remarks 默认配置: xxx, xxx
 */
export class {Construct} extends Construct {
  public readonly resource: ResourceType;

  constructor(scope: Construct, id: string, props: {Construct}Props) {
    super(scope, id);
    const { requiredProp, optionalProp = 100 } = props;
    // 创建资源...
  }

  /** 授予权限的 Grant 方法 */
  public grantXxx(grantee: iam.IGrantable): iam.Grant { ... }
}
```

### 安全默认配置

> 安全要求和原理详见 [security.md](security.md)，本节仅列出代码模板中的必须配置项。

| 资源 | 必须配置 |
|------|---------|
| S3 | `encryption: S3_MANAGED`, `blockPublicAccess: BLOCK_ALL`, `enforceSSL: true`, `versioned: true` |
| RDS | `storageEncrypted: true`, `deletionProtection: true`, `iamAuthentication: true`, `vpcSubnets: PRIVATE_ISOLATED` |
| Lambda | `tracing: ACTIVE`, `timeout: 30s`, 显式 LogGroup |
| API Gateway | 访问日志、节流、WAF |

### 导出模式

```typescript
// lib/constructs/{name}/index.ts
export { {Construct} } from './{name}.construct';
export type { {Construct}Props } from './{name}.construct';

// lib/constructs/index.ts (桶导出)
export * from './vpc';
export * from './aurora';
```

---

## 1. Props 接口设计

### 基本规则

```typescript
// ✅ readonly + 可选参数
export interface VpcConstructProps {
  readonly vpcCidr: string;
  readonly maxAzs?: number;        // 可选，解构时设默认值
  readonly enableNatGateway?: boolean;
}

// Stack Props 继承
export interface NetworkStackProps extends cdk.StackProps {
  readonly vpcCidr: string;
}
```

### 嵌套配置

```typescript
export interface AutoScalingConfig {
  readonly minCapacity: number;
  readonly maxCapacity: number;
  readonly targetCpuUtilization?: number;
}

export interface EcsServiceConstructProps {
  readonly vpc: ec2.IVpc;
  readonly autoScaling?: AutoScalingConfig;
}
```

---

## 2. Construct 实现模式

### 核心结构

```typescript
export class VpcConstruct extends Construct {
  public readonly vpc: ec2.Vpc;  // 暴露主资源

  constructor(scope: Construct, id: string, props: VpcConstructProps) {
    super(scope, id);

    // 1. 解构 + 默认值
    const { vpcCidr, maxAzs = 3, enableNatGateway = true } = props;

    // 2. 创建资源
    this.vpc = new ec2.Vpc(this, 'Vpc', { ... });
  }
}
```

### 暴露属性规则

```typescript
// 暴露供外部使用的属性
public readonly cluster: rds.DatabaseCluster;
public readonly clusterEndpoint: rds.Endpoint;
public readonly secret: secretsmanager.ISecret;

// 提供 Grant 方法
public grantDataApiAccess(grantee: iam.IGrantable): iam.Grant {
  return this.cluster.grantDataApiAccess(grantee);
}
```

---

## 3. 安全默认配置

> **职责边界**: 本节提供安全配置的**代码模板**。了解安全原理、IAM 最小权限、CDK Nag 规则等，请参考 [security.md](security.md)

### S3 Bucket

```typescript
this.bucket = new s3.Bucket(this, 'Bucket', {
  encryption: s3.BucketEncryption.S3_MANAGED,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  enforceSSL: true,
  versioned: true,
  removalPolicy: props.removalPolicy ?? cdk.RemovalPolicy.RETAIN,
});
```

### RDS/Aurora

```typescript
this.cluster = new rds.DatabaseCluster(this, 'Cluster', {
  storageEncrypted: true,
  deletionProtection: props.deletionProtection ?? true,
  iamAuthentication: true,
  vpc: props.vpc,
  vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
});
```

### Lambda

```typescript
this.function = new lambda.Function(this, 'Function', {
  tracing: lambda.Tracing.ACTIVE,
  timeout: props.timeout ?? cdk.Duration.seconds(30),
  memorySize: props.memorySize ?? 256,
});
```

---

## 4. JSDoc 注释

### Construct 注释

```typescript
/**
 * API Gateway Construct - 创建 REST API 入口。
 * @remarks 默认启用访问日志和 WAF 防护。
 */
export class ApiGatewayConstruct extends Construct { ... }
```

### Props 注释

```typescript
export interface ApiGatewayConstructProps {
  /** 部署阶段名称 (dev, staging, prod) */
  readonly stageName: string;
  /** API 请求节流限制 @default 1000 */
  readonly throttlingRateLimit?: number;
  /** 是否启用 WAF 防护 @default true */
  readonly enableWaf?: boolean;
}
```

---

## 相关文档

- [architecture.md](architecture.md) - Construct 分层规则
- [security.md](security.md) - 安全配置详细规范
- [testing.md](testing.md) - Construct 测试规范
