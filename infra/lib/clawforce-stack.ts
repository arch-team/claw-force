import * as cdk from 'aws-cdk-lib/core';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { ClawForceNetworking } from './constructs/networking';
import { ClawForceIam } from './constructs/iam';
import { ClawForceCompute } from './constructs/compute';

export interface ClawForceStackProps extends cdk.StackProps {
  /** CIDR range allowed for SSH and management access */
  allowedCidr?: string;
  /** EC2 instance type (default: t3.medium) */
  instanceType?: string;
  /** EBS volume size in GB (default: 30) */
  volumeSize?: number;
  /** SSH key pair name (optional - no SSH key if omitted) */
  keyPairName?: string;
  /** AWS region for Bedrock (default: us-east-1) */
  bedrockRegion?: string;
  /** Bedrock model ID in Inference Profile format */
  bedrockModelId?: string;
}

export class ClawForceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ClawForceStackProps = {}) {
    super(scope, id, props);

    const allowedCidr = props.allowedCidr ?? '0.0.0.0/0';
    const bedrockRegion = props.bedrockRegion ?? 'us-east-1';

    // Use default VPC (consistent with PoC approach)
    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true });

    // Networking: Security Group
    const networking = new ClawForceNetworking(this, 'Networking', {
      vpc,
      allowedCidr,
    });

    // IAM: Role + Instance Profile + Bedrock policy
    const iamResources = new ClawForceIam(this, 'Iam', {
      bedrockRegion,
    });

    // Compute: EC2 + EBS + User Data with all PoC fixes
    const compute = new ClawForceCompute(this, 'Compute', {
      vpc,
      securityGroup: networking.securityGroup,
      role: iamResources.role,
      instanceType: props.instanceType,
      volumeSize: props.volumeSize,
      keyPairName: props.keyPairName,
      bedrockRegion,
      bedrockModelId: props.bedrockModelId,
    });

    // Outputs
    new cdk.CfnOutput(this, 'InstanceId', {
      value: compute.instance.instanceId,
      description: 'EC2 Instance ID',
    });

    new cdk.CfnOutput(this, 'PublicIp', {
      value: compute.instance.instancePublicIp,
      description: 'EC2 Public IP Address',
    });

    new cdk.CfnOutput(this, 'SshCommand', {
      value: `ssh -i <your-key>.pem ubuntu@${compute.instance.instancePublicIp}`,
      description: 'SSH connection command',
    });

    new cdk.CfnOutput(this, 'GatewayUrl', {
      value: `ws://${compute.instance.instancePublicIp}:18789`,
      description: 'OpenClaw Gateway WebSocket URL',
    });

    new cdk.CfnOutput(this, 'ControlUiUrl', {
      value: `http://${compute.instance.instancePublicIp}:18790`,
      description: 'OpenClaw Control UI URL',
    });
  }
}
