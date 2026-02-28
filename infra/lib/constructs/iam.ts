import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib/core';

export interface ClawForceIamProps {
  /** AWS region for Bedrock access (default: us-east-1) */
  bedrockRegion?: string;
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

    const region = props.bedrockRegion ?? 'us-east-1';

    this.role = new iam.Role(this, 'Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      // PoC lesson: ASCII-only descriptions
      description: 'ClawForce OpenClaw EC2 instance role with Bedrock access',
    });

    // Bedrock InvokeModel permission
    // PoC lesson: Must include both model/* AND inference-profile/* ARNs
    this.role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock:InvokeModel',
          'bedrock:InvokeModelWithResponseStream',
        ],
        resources: [
          `arn:aws:bedrock:${region}::foundation-model/*`,
          `arn:aws:bedrock:${region}:${cdk.Aws.ACCOUNT_ID}:inference-profile/*`,
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

    this.instanceProfile = new iam.InstanceProfile(this, 'InstanceProfile', {
      role: this.role,
    });
  }
}
