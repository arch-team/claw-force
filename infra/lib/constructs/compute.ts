import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { NagSuppressions } from 'cdk-nag';
import { buildUserDataCommands, buildUserDataSetupCommands, FeishuConfig } from './user-data';
import { DEFAULTS } from '../config/constants';

export interface ClawForceComputeProps {
  /** VPC to launch the instance in */
  readonly vpc: ec2.IVpc;
  /** Security group for the instance */
  readonly securityGroup: ec2.SecurityGroup;
  /** IAM role for the instance */
  readonly role: iam.Role;
  /** EC2 instance type (default: t3.medium) */
  readonly instanceType?: string;
  /** EBS volume size in GB (default: 30) */
  readonly volumeSize?: number;
  /** SSH key pair name (optional) */
  readonly keyPairName?: string;
  /** AWS region for Bedrock */
  readonly bedrockRegion: string;
  /** Bedrock model ID in Inference Profile format */
  readonly bedrockModelId: string;
  /** OpenClaw Gateway token */
  readonly gatewayToken: string;
  /** CloudWatch Agent config JSON (injected by monitoring construct) */
  readonly cloudWatchAgentConfig?: string;
  /** Feishu channel config — omit to disable Feishu integration */
  readonly feishu?: FeishuConfig;
  /** Hooks API token — omit to disable hooks endpoint (POST /hooks/agent) */
  readonly hooksToken?: string;
  /** EFS DNS name for persistent data mount (omit to use local EBS only) */
  readonly efsDnsName?: string;
  /** If true, use setup-only UserData (stack will add start commands after ALB config) */
  readonly deferStart?: boolean;
}

/**
 * EC2 compute construct for ClawForce OpenClaw deployment (direct install, no Docker).
 *
 * PoC lessons applied:
 * - IMDSv2 enforced (CDK default hop limit=1, sufficient without Docker)
 * - Ubuntu 24.04 uses ssh.service not sshd.service (poc-report.md #2)
 * - Bedrock uses Inference Profile format model ID (poc-report.md #5)
 * - All descriptions ASCII-only (poc-report.md #1)
 */
export class ClawForceCompute extends Construct {
  public readonly instance: ec2.Instance;

  constructor(scope: Construct, id: string, props: ClawForceComputeProps) {
    super(scope, id);

    const instanceType = new ec2.InstanceType(props.instanceType ?? DEFAULTS.INSTANCE_TYPE);
    const volumeSize = props.volumeSize ?? DEFAULTS.VOLUME_SIZE;

    // Ubuntu 24.04 LTS AMI lookup
    const machineImage = ec2.MachineImage.lookup({
      name: 'ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*',
      owners: ['099720109477'], // Canonical
    });

    // User Data script with all PoC fixes (see user-data.ts for details)
    // When deferStart=true, setup commands only — stack adds ALB config then start.
    const userData = ec2.UserData.forLinux();
    const userDataParams = {
      bedrockRegion: props.bedrockRegion,
      bedrockModelId: props.bedrockModelId,
      gatewayToken: props.gatewayToken,
      cloudWatchAgentConfig: props.cloudWatchAgentConfig,
      feishu: props.feishu,
      hooksToken: props.hooksToken,
      efsDnsName: props.efsDnsName,
    };
    userData.addCommands(
      ...(props.deferStart
        ? buildUserDataSetupCommands(userDataParams)
        : buildUserDataCommands(userDataParams)),
    );

    this.instance = new ec2.Instance(this, 'Instance', {
      vpc: props.vpc,
      instanceType,
      machineImage,
      securityGroup: props.securityGroup,
      role: props.role,
      userData,
      // PoC fix #1: ASCII-only instance name
      instanceName: 'ClawForce-OpenClaw',
      blockDevices: [
        {
          deviceName: '/dev/sda1',
          volume: ec2.BlockDeviceVolume.ebs(volumeSize, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            encrypted: true,
          }),
        },
      ],
      // IMDSv2 enforced (hop limit=1 default, no Docker container layer)
      requireImdsv2: true,
      ...(props.keyPairName
        ? { keyPair: ec2.KeyPair.fromKeyPairName(this, 'KeyPair', props.keyPairName) }
        : {}),
    });

    // CDK Nag suppressions (resource-level)
    NagSuppressions.addResourceSuppressions(
      this.instance,
      [
        {
          id: 'AwsSolutions-EC26',
          reason:
            'EBS encryption is enabled via blockDevices configuration on the Instance construct',
        },
        {
          id: 'AwsSolutions-EC28',
          reason:
            'Detailed monitoring is a cost optimization decision; CloudWatch alarms provide sufficient observability for current stage',
        },
        {
          id: 'AwsSolutions-EC29',
          reason:
            'Termination protection is intentionally not enabled for dev environment to allow easy teardown',
        },
      ],
      true,
    );
  }
}
