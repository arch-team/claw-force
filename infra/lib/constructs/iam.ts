import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib/core';
import { NagSuppressions } from 'cdk-nag';
import { DEFAULTS } from '../config/constants';

export interface ClawForceIamProps {
  /** AWS region for Bedrock access (default: us-east-1) */
  readonly bedrockRegion?: string;
}

/**
 * IAM Role + Instance Profile for ClawForce EC2 instance.
 *
 * PoC lessons applied:
 * - Bedrock policy includes inference-profile/* ARN (poc-report.md #6)
 * - Uses Inference Profile format model IDs (poc-report.md #5)
 */
export class ClawForceIam extends Construct {
  public readonly role: iam.Role;
  public readonly instanceProfile: iam.InstanceProfile;

  constructor(scope: Construct, id: string, props: ClawForceIamProps = {}) {
    super(scope, id);

    const region = props.bedrockRegion ?? DEFAULTS.BEDROCK_REGION;

    this.role = new iam.Role(this, 'Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      // PoC lesson: ASCII-only descriptions
      description: 'ClawForce OpenClaw EC2 instance role with Bedrock access',
    });

    // Bedrock InvokeModel permission
    // Cross-region inference profiles (us.anthropic.claude-*) route requests to
    // ANY US region (us-east-1, us-east-2, us-west-2, etc.). IAM must allow
    // foundation-model/* in ALL regions, not just the configured one.
    this.role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [
          // foundation-model: any region (cross-region profile routes unpredictably)
          'arn:aws:bedrock:*::foundation-model/*',
          // inference-profile: single-region (configured region)
          `arn:aws:bedrock:${region}:${cdk.Aws.ACCOUNT_ID}:inference-profile/*`,
          // inference-profile: cross-region (us.* prefix)
          `arn:aws:bedrock:us:${cdk.Aws.ACCOUNT_ID}:inference-profile/*`,
        ],
      }),
    );

    // Bedrock model listing (for model discovery)
    this.role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock:ListFoundationModels',
          'bedrock:ListInferenceProfiles',
          'bedrock:GetFoundationModel',
        ],
        resources: ['*'],
      }),
    );

    // CloudWatch Agent permissions
    this.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
    );

    this.instanceProfile = new iam.InstanceProfile(this, 'InstanceProfile', {
      role: this.role,
    });

    // CDK Nag suppressions (resource-level)
    NagSuppressions.addResourceSuppressions(
      this.role,
      [
        {
          id: 'AwsSolutions-IAM4',
          reason: 'CloudWatchAgentServerPolicy is the AWS recommended managed policy for CW Agent',
        },
        {
          id: 'AwsSolutions-IAM5',
          reason:
            'Bedrock ListFoundationModels/ListInferenceProfiles require wildcard resource; foundation-model/* is the narrowest scope for InvokeModel across all models',
        },
      ],
      true,
    );
  }
}
