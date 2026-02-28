import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { buildUserDataCommands } from './user-data';

export interface ClawForceComputeProps {
  /** VPC to launch the instance in */
  vpc: ec2.IVpc;
  /** Security group for the instance */
  securityGroup: ec2.SecurityGroup;
  /** IAM role for the instance */
  role: iam.Role;
  /** EC2 instance type (default: t3.medium) */
  instanceType?: string;
  /** EBS volume size in GB (default: 30) */
  volumeSize?: number;
  /** SSH key pair name (optional) */
  keyPairName?: string;
  /** AWS region for Bedrock (default: us-east-1) */
  bedrockRegion?: string;
  /** Bedrock model ID in Inference Profile format */
  bedrockModelId?: string;
  /** OpenClaw Gateway token (generated if not provided) */
  gatewayToken?: string;
  /** CloudWatch Agent config JSON (injected by monitoring construct) */
  cloudWatchAgentConfig?: string;
}

/**
 * EC2 compute construct for ClawForce OpenClaw deployment.
 *
 * PoC lessons applied:
 * - IMDSv2 enforced with hop limit=2 for Docker container access (poc-report.md #4)
 * - Ubuntu 24.04 uses ssh.service not sshd.service (poc-report.md #2)
 * - Docker Compose override injects AWS_REGION (poc-report.md #10)
 * - Bedrock uses Inference Profile format model ID (poc-report.md #5)
 * - All descriptions ASCII-only (poc-report.md #1)
 */
export class ClawForceCompute extends Construct {
  public readonly instance: ec2.Instance;

  constructor(scope: Construct, id: string, props: ClawForceComputeProps) {
    super(scope, id);

    const instanceType = new ec2.InstanceType(props.instanceType ?? 't3.medium');
    const volumeSize = props.volumeSize ?? 30;
    const bedrockRegion = props.bedrockRegion ?? 'us-east-1';
    const bedrockModelId = props.bedrockModelId ?? 'us.anthropic.claude-sonnet-4-5-20250929-v1:0';

    // Ubuntu 24.04 LTS AMI lookup
    const machineImage = ec2.MachineImage.lookup({
      name: 'ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*',
      owners: ['099720109477'], // Canonical
    });

    // User Data script with all PoC fixes (see user-data.ts for details)
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      ...buildUserDataCommands({
        bedrockRegion,
        bedrockModelId,
        cloudWatchAgentConfig: props.cloudWatchAgentConfig,
      }),
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
      // PoC fix #4: IMDSv2 enforced with hop limit=2 for Docker container access
      requireImdsv2: true,
      ...(props.keyPairName
        ? { keyPair: ec2.KeyPair.fromKeyPairName(this, 'KeyPair', props.keyPairName) }
        : {}),
    });

    // Set IMDS hop limit to 2 (CDK's requireImdsv2 sets hop=1, we need 2 for Docker)
    const cfnInstance = this.instance.node.defaultChild as ec2.CfnInstance;
    cfnInstance.addPropertyOverride('MetadataOptions.HttpPutResponseHopLimit', 2);
  }
}
