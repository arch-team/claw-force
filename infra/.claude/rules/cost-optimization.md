# 成本优化规范

> **职责**: 定义资源选型、环境资源矩阵、存储优化、网络优化和成本监控策略。

> Claude 设计 CDK 基础设施时优先查阅

---

## 0. 速查卡片

### 环境资源矩阵

| 资源 | Dev | Staging (暂不实现) | Prod |
|------|-----|-------------------|------|
| EC2/ECS | t3.small, 按需 | t3.medium, 按需 | t3.large, Reserved |
| RDS | db.t3.medium, 单AZ | db.t3.medium, 多AZ | db.r6g.large, 多AZ, Reserved |
| NAT Gateway | 1 | 2 | 3 (每AZ) |
| Lambda | 默认 | 默认 | ARM + 优化内存 |

### 必须标签

```typescript
// bin/app.ts - 应用到所有资源
const requiredTags = { Project: 'clawforce', Environment: envName, CostCenter: 'clawforce', ManagedBy: 'cdk' };
Object.entries(requiredTags).forEach(([k, v]) => cdk.Tags.of(app).add(k, v));

// Prod 额外标签 (暂不实现，待业务上线后启用)
// if (envName === 'prod') cdk.Tags.of(app).add('Criticality', 'high');
```

---

## 1. 计算优化

### Dev 定时缩减（必须）

```typescript
// Dev: 非工作时间缩减到 0
if (envName === 'dev') {
  scaling.scaleOnSchedule('Down', { schedule: cron({ hour: '20' }), minCapacity: 0 });
  scaling.scaleOnSchedule('Up',   { schedule: cron({ hour: '8' }),  minCapacity: 1 });
}
```

### Lambda 优化

```typescript
architecture: lambda.Architecture.ARM_64,  // 节省约 20%
memorySize: envConfig.lambdaMemory ?? 256, // 使用 Power Tuning 确定最优值
```

---

## 2. 存储优化

### S3 生命周期（必须）

```typescript
lifecycleRules: [
  { transitions: [
      { storageClass: s3.StorageClass.INFREQUENT_ACCESS, transitionAfter: cdk.Duration.days(30) },
      { storageClass: s3.StorageClass.GLACIER, transitionAfter: cdk.Duration.days(90) },
  ]},
  { noncurrentVersionExpiration: cdk.Duration.days(30) },
  { abortIncompleteMultipartUploadAfter: cdk.Duration.days(7) },
],
```

### EBS: gp3 优于 gp2

```typescript
volumeType: ec2.EbsDeviceVolumeType.GP3,  // 可自定义 IOPS/吞吐量，成本更低
```

---

## 3. 网络优化

### NAT Gateway 策略

| 环境 | NAT 配置 | 成本参考 |
|------|---------|---------|
| Dev | 1 个或 NAT Instance | ~$4/月 (Instance) vs ~$30/月 (Gateway) |
| Prod | 每 AZ 一个 | 高可用 |

### VPC Endpoints（减少 NAT 流量）

```typescript
// Gateway Endpoints (免费)
vpc.addGatewayEndpoint('S3', { service: ec2.GatewayVpcEndpointAwsService.S3 });
vpc.addGatewayEndpoint('DynamoDB', { service: ec2.GatewayVpcEndpointAwsService.DYNAMODB });

// Interface Endpoints (Prod 按需)
if (envName === 'prod') {
  vpc.addInterfaceEndpoint('SecretsManager', { service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER });
}
```

---

## 4. 资源清理

### CloudWatch Logs 保留

```typescript
retention: envName === 'prod' ? logs.RetentionDays.ONE_YEAR : logs.RetentionDays.ONE_WEEK,
```

> RemovalPolicy 策略详见 deployment.md §1

---

## 5. 成本监控

### 预算告警

```typescript
new budgets.CfnBudget(this, 'Budget', {
  budget: {
    budgetLimit: { amount: envName === 'prod' ? 1000 : 100, unit: 'USD' },
    budgetType: 'COST',
    timeUnit: 'MONTHLY',
  },
  notificationsWithSubscribers: [{
    notification: { threshold: 80, thresholdType: 'PERCENTAGE', comparisonOperator: 'GREATER_THAN', notificationType: 'ACTUAL' },
    subscribers: [{ address: 'platform-team@example.com', subscriptionType: 'EMAIL' }],
  }],
});
```

在 Billing Console 启用成本分配标签: `Project`, `Environment`, `CostCenter`

---

## 6. 审计清单

**月度**: 未使用 EBS 卷 | 未关联弹性 IP | 空闲 LB | RI 利用率 | S3 存储类

**季度**: RI/Savings Plans 续期 | 实例类型评估 | Spot 机会 | 跨区域传输
