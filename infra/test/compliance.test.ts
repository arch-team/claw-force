import { Aspects } from 'aws-cdk-lib/core';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';
import { Template } from 'aws-cdk-lib/assertions';
import { ClawForceStack } from '../lib/clawforce-stack';
import { createTestApp, TEST_ACCOUNT, TEST_REGION } from './test-helpers';

describe('CDK Nag Compliance - ClawForceStack (ALB mode)', () => {
  test('passes AWS Solutions checks with documented suppressions', () => {
    const app = createTestApp();
    const stack = new ClawForceStack(app, 'TestNagStack', {
      env: { account: TEST_ACCOUNT, region: TEST_REGION },
    });

    // Suppressions for known acceptable patterns in this project
    NagSuppressions.addStackSuppressions(stack, [
      {
        id: 'AwsSolutions-IAM4',
        reason: 'CloudWatchAgentServerPolicy is the AWS recommended managed policy for CW Agent',
      },
      {
        id: 'AwsSolutions-IAM5',
        reason:
          'Bedrock ListFoundationModels/ListInferenceProfiles require wildcard resource; foundation-model/* is the narrowest scope for InvokeModel across all models',
      },
      {
        id: 'AwsSolutions-EC26',
        reason: 'EBS encryption is enabled via blockDevices configuration on the Instance construct',
      },
      {
        id: 'AwsSolutions-EC28',
        reason: 'Detailed monitoring is a cost optimization decision; CloudWatch alarms provide sufficient observability for current stage',
      },
      {
        id: 'AwsSolutions-EC29',
        reason: 'Termination protection is intentionally not enabled for dev environment to allow easy teardown',
      },
      {
        id: 'AwsSolutions-ELB2',
        reason: 'ALB access logs require an S3 bucket; deferred to cost-optimization phase to avoid unnecessary S3 costs',
      },
      {
        id: 'AwsSolutions-EC23',
        reason: 'ALB security group intentionally allows 0.0.0.0/0 on ports 80/443 as it is an internet-facing load balancer',
      },
      {
        id: 'AwsSolutions-VPC3',
        reason: 'Using default VPC for PoC/dev stage; custom VPC with flow logs planned for production',
      },
    ]);

    Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

    // Synthesize to trigger Nag checks
    const messages = app.synth().getStackArtifact(stack.artifactId).messages;
    const errors = messages.filter((m) => m.level === 'error');

    if (errors.length > 0) {
      console.error('CDK Nag errors:');
      errors.forEach((e) => console.error(`  ${e.id}: ${e.entry.data}`));
    }

    expect(errors).toHaveLength(0);
  });
});

describe('CDK Nag Compliance - ClawForceStack (direct mode)', () => {
  test('passes AWS Solutions checks with documented suppressions', () => {
    const app = createTestApp();
    const stack = new ClawForceStack(app, 'TestNagDirectStack', {
      env: { account: TEST_ACCOUNT, region: TEST_REGION },
      enableAlb: false,
    });

    NagSuppressions.addStackSuppressions(stack, [
      {
        id: 'AwsSolutions-IAM4',
        reason: 'CloudWatchAgentServerPolicy is the AWS recommended managed policy for CW Agent',
      },
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Bedrock requires wildcard resources for model listing and inference',
      },
      {
        id: 'AwsSolutions-EC26',
        reason: 'EBS encryption is enabled via blockDevices configuration',
      },
      {
        id: 'AwsSolutions-EC28',
        reason: 'Detailed monitoring deferred for cost optimization',
      },
      {
        id: 'AwsSolutions-EC29',
        reason: 'Termination protection not needed for dev environment',
      },
      {
        id: 'AwsSolutions-EC23',
        reason: 'Direct mode allows configurable CIDR for OpenClaw service ports',
      },
      {
        id: 'AwsSolutions-VPC3',
        reason: 'Using default VPC for PoC/dev stage',
      },
    ]);

    Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

    const messages = app.synth().getStackArtifact(stack.artifactId).messages;
    const errors = messages.filter((m) => m.level === 'error');

    if (errors.length > 0) {
      console.error('CDK Nag errors:');
      errors.forEach((e) => console.error(`  ${e.id}: ${e.entry.data}`));
    }

    expect(errors).toHaveLength(0);
  });
});
