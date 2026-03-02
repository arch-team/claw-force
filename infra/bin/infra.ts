#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { ClawForceStack } from '../lib/stacks/clawforce-stack';
import { DEFAULTS } from '../lib/config/constants';

const app = new cdk.App();

// Parse volumeSize with explicit validation
const rawVolumeSize = app.node.tryGetContext('volumeSize');
let volumeSize: number = DEFAULTS.VOLUME_SIZE;
if (rawVolumeSize !== undefined) {
  volumeSize = parseInt(String(rawVolumeSize), 10);
  if (Number.isNaN(volumeSize) || volumeSize < 8) {
    throw new Error(`volumeSize must be a number >= 8, got: ${rawVolumeSize}`);
  }
}

// Parse enableAlb: treat 'false', '0', 'no' (case-insensitive) as false
const rawEnableAlb = app.node.tryGetContext('enableAlb');
const enableAlb =
  rawEnableAlb === undefined || !['false', '0', 'no'].includes(String(rawEnableAlb).toLowerCase());

new ClawForceStack(app, 'ClawForceStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? DEFAULTS.BEDROCK_REGION,
  },

  // Deployment configuration (override via cdk.json context or CLI --context)
  allowedCidr: app.node.tryGetContext('allowedCidr') ?? DEFAULTS.ALLOWED_CIDR,
  instanceType: app.node.tryGetContext('instanceType') ?? DEFAULTS.INSTANCE_TYPE,
  volumeSize,
  keyPairName: app.node.tryGetContext('keyPairName'),
  bedrockRegion: app.node.tryGetContext('bedrockRegion') ?? DEFAULTS.BEDROCK_REGION,
  bedrockModelId: app.node.tryGetContext('bedrockModelId'),

  // Network security (ALB + WAF)
  enableAlb,
  certificateArn: app.node.tryGetContext('certificateArn'),

  // Data persistence (EFS)
  efsFileSystemId: app.node.tryGetContext('efsFileSystemId'),
});
