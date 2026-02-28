import { Aspects } from 'aws-cdk-lib/core';
import { AwsSolutionsChecks } from 'cdk-nag';
import { ClawForceStack } from '../lib/stacks/clawforce-stack';
import { createTestApp, TEST_ACCOUNT, TEST_REGION } from './test-helpers';

describe('CDK Nag Compliance - ClawForceStack (ALB mode)', () => {
  test('passes AWS Solutions checks with resource-level suppressions', () => {
    const app = createTestApp();
    const stack = new ClawForceStack(app, 'TestNagStack', {
      env: { account: TEST_ACCOUNT, region: TEST_REGION },
    });

    // No stack-level suppressions needed - all suppressions are resource-level
    // inside each construct (iam.ts, compute.ts, alb.ts) and stack (VPC3 only)

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

describe('CDK Nag Compliance - ClawForceStack (direct mode)', () => {
  test('passes AWS Solutions checks with resource-level suppressions', () => {
    const app = createTestApp();
    const stack = new ClawForceStack(app, 'TestNagDirectStack', {
      env: { account: TEST_ACCOUNT, region: TEST_REGION },
      enableAlb: false,
    });

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
