import * as cdk from 'aws-cdk-lib/core';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import { ClawForceNetworking } from '../constructs/networking';
import { ClawForceIam } from '../constructs/iam';
import { ClawForceCompute } from '../constructs/compute';
import { ClawForceAlb } from '../constructs/alb';
import { ClawForceWaf } from '../constructs/waf';
import { ClawForceMonitoring } from '../constructs/monitoring';
import { DEFAULTS, OPENCLAW_PORTS } from '../config/constants';

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
  /** ACM certificate ARN for HTTPS (optional - HTTP only if omitted) */
  certificateArn?: string;
  /** Enable ALB + WAF (default: true) */
  enableAlb?: boolean;
}

export class ClawForceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ClawForceStackProps = {}) {
    super(scope, id, props);

    const allowedCidr = props.allowedCidr ?? DEFAULTS.ALLOWED_CIDR;
    const bedrockRegion = props.bedrockRegion ?? DEFAULTS.BEDROCK_REGION;
    const enableAlb = props.enableAlb ?? true;

    // Use default VPC (consistent with PoC approach)
    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true });

    // IAM: Role + Instance Profile + Bedrock policy
    const iamResources = new ClawForceIam(this, 'Iam', {
      bedrockRegion,
    });

    // Monitoring: CloudWatch Log Groups + Agent config (phase 1 - before compute)
    const monitoring = new ClawForceMonitoring(this, 'Monitoring');

    // Networking: Security Group (SSH only - OpenClaw ports managed below)
    const networking = new ClawForceNetworking(this, 'Networking', {
      vpc,
      allowedCidr,
    });

    // Compute: EC2 + EBS + User Data with all PoC fixes + CloudWatch Agent
    const compute = new ClawForceCompute(this, 'Compute', {
      vpc,
      securityGroup: networking.securityGroup,
      role: iamResources.role,
      instanceType: props.instanceType,
      volumeSize: props.volumeSize,
      keyPairName: props.keyPairName,
      bedrockRegion,
      bedrockModelId: props.bedrockModelId,
      cloudWatchAgentConfig: monitoring.getAgentConfig(),
    });

    // Monitoring: Alarms (phase 2 - after compute)
    monitoring.addAlarms(compute.instance);

    // OpenClaw service port rules: ALB mode vs direct mode
    let albConstruct: ClawForceAlb | undefined;

    if (enableAlb) {
      // ALB: Load Balancer + Target Groups + Listeners
      albConstruct = new ClawForceAlb(this, 'Alb', {
        vpc,
        instance: compute.instance,
        certificateArn: props.certificateArn,
      });

      // Add ALB->EC2 ingress rule for Gateway port (serves both Gateway + Control UI)
      networking.securityGroup.addIngressRule(
        ec2.Peer.securityGroupId(albConstruct.albSecurityGroup.securityGroupId),
        ec2.Port.tcp(OPENCLAW_PORTS.GATEWAY),
        'OpenClaw Gateway + Control UI from ALB',
      );

      // WAF: WebACL + AWS Managed Rules -> ALB
      new ClawForceWaf(this, 'Waf', {
        albArn: albConstruct.alb.loadBalancerArn,
      });
    } else {
      // Direct mode: Gateway port from allowed CIDR (serves both Gateway + Control UI)
      const peer = ec2.Peer.ipv4(allowedCidr);

      networking.securityGroup.addIngressRule(
        peer,
        ec2.Port.tcp(OPENCLAW_PORTS.GATEWAY),
        'OpenClaw Gateway + Control UI',
      );
    }

    // CDK Nag: VPC3 on imported default VPC (cannot suppress at resource level)
    NagSuppressions.addStackSuppressions(this, [
      {
        id: 'AwsSolutions-VPC3',
        reason:
          'Using default VPC for PoC/dev stage; custom VPC with flow logs planned for production',
      },
    ]);

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

    if (albConstruct) {
      const protocol = props.certificateArn ? 'https' : 'http';

      new cdk.CfnOutput(this, 'AlbDnsName', {
        value: albConstruct.alb.loadBalancerDnsName,
        description: 'ALB DNS Name',
      });

      new cdk.CfnOutput(this, 'ControlUiUrl', {
        value: `${protocol}://${albConstruct.alb.loadBalancerDnsName}`,
        description: 'OpenClaw Control UI URL (via ALB)',
      });

      new cdk.CfnOutput(this, 'GatewayUrl', {
        value: `${protocol === 'https' ? 'wss' : 'ws'}://${albConstruct.alb.loadBalancerDnsName}/ws`,
        description: 'OpenClaw Gateway WebSocket URL (via ALB)',
      });
    } else {
      new cdk.CfnOutput(this, 'GatewayUrl', {
        value: `ws://${compute.instance.instancePublicIp}:18789`,
        description: 'OpenClaw Gateway WebSocket URL',
      });

      new cdk.CfnOutput(this, 'ControlUiUrl', {
        value: `http://${compute.instance.instancePublicIp}:${OPENCLAW_PORTS.GATEWAY}`,
        description: 'OpenClaw Control UI URL',
      });
    }
  }
}
