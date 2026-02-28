#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { ClawForceStack } from '../lib/clawforce-stack';

const app = new cdk.App();

new ClawForceStack(app, 'ClawForceStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },

  // Deployment configuration (override via cdk.json context or CLI --context)
  allowedCidr: app.node.tryGetContext('allowedCidr') ?? '0.0.0.0/0',
  instanceType: app.node.tryGetContext('instanceType') ?? 't3.medium',
  volumeSize: Number(app.node.tryGetContext('volumeSize')) || 30,
  keyPairName: app.node.tryGetContext('keyPairName'),
  bedrockRegion: app.node.tryGetContext('bedrockRegion') ?? 'us-east-1',
  bedrockModelId: app.node.tryGetContext('bedrockModelId'),

  // Network security (ALB + WAF)
  enableAlb: app.node.tryGetContext('enableAlb') !== 'false',
  certificateArn: app.node.tryGetContext('certificateArn'),
});
