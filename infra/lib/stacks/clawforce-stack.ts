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
import { ClawForceEfs } from '../constructs/efs';
import { DEFAULTS, OPENCLAW_PORTS } from '../config/constants';
import { buildAlbCorsCommands, startOpenClawCommands, FeishuConfig } from '../constructs/user-data';

/**
 * Token fragment for auto-authentication.
 * NOT included in CfnOutputs to avoid leaking via CloudFormation describe-stacks.
 * Users should append manually: URL/#token=<your-token>
 */
const TOKEN_HINT = '/#token=<your-gateway-token>';

export interface ClawForceStackProps extends cdk.StackProps {
  /** CIDR range allowed for SSH and management access */
  readonly allowedCidr?: string;
  /** EC2 instance type (default: t3.medium) */
  readonly instanceType?: string;
  /** EBS volume size in GB (default: 30) */
  readonly volumeSize?: number;
  /** SSH key pair name (optional - no SSH key if omitted) */
  readonly keyPairName?: string;
  /** AWS region for Bedrock (default: us-east-1) */
  readonly bedrockRegion?: string;
  /** Bedrock model ID in Inference Profile format */
  readonly bedrockModelId?: string;
  /** ACM certificate ARN for HTTPS (optional - HTTP only if omitted) */
  readonly certificateArn?: string;
  /** Enable ALB + WAF (default: true) */
  readonly enableAlb?: boolean;
  /** Feishu channel config — pass to enable Feishu AI employee bot */
  readonly feishu?: FeishuConfig;
  /** Enable Hooks API for external webhook integrations (default: true when Feishu enabled) */
  readonly enableHooks?: boolean;
  /** Existing EFS filesystem ID to reuse for data persistence */
  readonly efsFileSystemId?: string;
}

export class ClawForceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ClawForceStackProps = {}) {
    super(scope, id, props);

    const allowedCidr = props.allowedCidr ?? DEFAULTS.ALLOWED_CIDR;
    const bedrockRegion = props.bedrockRegion ?? DEFAULTS.BEDROCK_REGION;
    const bedrockModelId = props.bedrockModelId ?? DEFAULTS.BEDROCK_MODEL_ID;
    const gatewayToken = DEFAULTS.GATEWAY_TOKEN;
    const enableAlb = props.enableAlb ?? true;

    // Feishu integration: read from props or CDK context
    const feishuAppId =
      props.feishu?.appId ?? (this.node.tryGetContext('feishuAppId') as string | undefined);
    const feishuAppSecret =
      props.feishu?.appSecret ?? (this.node.tryGetContext('feishuAppSecret') as string | undefined);
    const feishu: FeishuConfig | undefined =
      feishuAppId && feishuAppSecret
        ? { appId: feishuAppId, appSecret: feishuAppSecret }
        : undefined;

    // Hooks API: enabled by default when Feishu is configured
    const enableHooks = props.enableHooks ?? !!feishu;
    const hooksToken = enableHooks ? DEFAULTS.HOOKS_TOKEN : undefined;

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

    // EFS: Persistent data storage (survives destroy+deploy cycles)
    const efsFileSystemId =
      props.efsFileSystemId ?? (this.node.tryGetContext('efsFileSystemId') as string | undefined);

    const efsConstruct = new ClawForceEfs(this, 'Efs', {
      vpc,
      instanceSecurityGroup: networking.securityGroup,
      existingFileSystemId: efsFileSystemId,
    });

    // Construct EFS DNS name for NFS mount in UserData
    const efsDnsName = `${efsConstruct.fileSystemId}.efs.${this.region}.amazonaws.com`;

    // Compute: EC2 + EBS + User Data with all PoC fixes + CloudWatch Agent
    // When ALB is enabled, deferStart=true so we can inject ALB CORS config
    // before docker compose up (eliminates CORS gap on fresh instances).
    const compute = new ClawForceCompute(this, 'Compute', {
      vpc,
      securityGroup: networking.securityGroup,
      role: iamResources.role,
      instanceType: props.instanceType,
      volumeSize: props.volumeSize,
      keyPairName: props.keyPairName,
      bedrockRegion,
      bedrockModelId,
      gatewayToken,
      cloudWatchAgentConfig: monitoring.getAgentConfig(),
      feishu,
      hooksToken,
      efsDnsName,
      deferStart: enableAlb,
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

      // Configure Gateway for ALB mode (CR-008):
      // 1. CORS: inject concrete ALB DNS (wildcard "*" not supported by OpenClaw)
      // 2. Trusted Proxies: ALB internal IP so OpenClaw treats proxied requests as local
      // These commands run BEFORE docker compose up (deferStart=true above),
      // so the container starts with correct config — no restart needed.
      const albDns = albConstruct.alb.loadBalancerDnsName;
      const protocol = props.certificateArn ? 'https' : 'http';
      compute.instance.userData.addCommands(
        ...buildAlbCorsCommands(albDns, protocol),
        '',
        '# === Start OpenClaw (after all config is finalized) ===',
        ...startOpenClawCommands(),
        '',
        'echo "ClawForce OpenClaw setup complete at $(date)"',
      );
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

    new cdk.CfnOutput(this, 'EfsFileSystemId', {
      value: efsConstruct.fileSystemId,
      description:
        'EFS filesystem ID — save to cdk.json as "efsFileSystemId" to persist data across destroy+deploy',
    });

    if (albConstruct) {
      const protocol = props.certificateArn ? 'https' : 'http';

      new cdk.CfnOutput(this, 'AlbDnsName', {
        value: albConstruct.alb.loadBalancerDnsName,
        description: 'ALB DNS Name',
      });

      new cdk.CfnOutput(this, 'ControlUiUrl', {
        value: `${protocol}://${albConstruct.alb.loadBalancerDnsName}/`,
        description: `OpenClaw Control UI URL (via ALB) — append ${TOKEN_HINT} to auto-authenticate`,
      });

      new cdk.CfnOutput(this, 'GatewayUrl', {
        value: `${protocol === 'https' ? 'wss' : 'ws'}://${albConstruct.alb.loadBalancerDnsName}/ws`,
        description: 'OpenClaw Gateway WebSocket URL (via ALB)',
      });
    } else {
      new cdk.CfnOutput(this, 'GatewayUrl', {
        value: `ws://${compute.instance.instancePublicIp}:${OPENCLAW_PORTS.GATEWAY}`,
        description: 'OpenClaw Gateway WebSocket URL',
      });

      new cdk.CfnOutput(this, 'ControlUiUrl', {
        value: `http://${compute.instance.instancePublicIp}:${OPENCLAW_PORTS.GATEWAY}/`,
        description: `OpenClaw Control UI URL — append ${TOKEN_HINT} to auto-authenticate`,
      });
    }
  }
}
