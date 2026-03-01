#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { ClawForceStack } from '../lib/stacks/clawforce-stack';
import { DEFAULTS } from '../lib/config/constants';

const app = new cdk.App();

new ClawForceStack(app, 'ClawForceStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? DEFAULTS.BEDROCK_REGION,
  },

  // Deployment configuration (override via cdk.json context or CLI --context)
  allowedCidr: app.node.tryGetContext('allowedCidr') ?? DEFAULTS.ALLOWED_CIDR,
  instanceType: app.node.tryGetContext('instanceType') ?? DEFAULTS.INSTANCE_TYPE,
  volumeSize: Number(app.node.tryGetContext('volumeSize')) || DEFAULTS.VOLUME_SIZE,
  keyPairName: app.node.tryGetContext('keyPairName'),
  bedrockRegion: app.node.tryGetContext('bedrockRegion') ?? DEFAULTS.BEDROCK_REGION,
  bedrockModelId: app.node.tryGetContext('bedrockModelId'),

  // Network security (ALB + WAF)
  enableAlb: app.node.tryGetContext('enableAlb') !== 'false',
  certificateArn: app.node.tryGetContext('certificateArn'),
});
