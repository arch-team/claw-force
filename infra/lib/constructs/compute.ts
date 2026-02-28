import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib/core';

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

    // User Data script with all PoC fixes embedded
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      '#!/bin/bash',
      'set -euo pipefail',
      'exec > >(tee /var/log/clawforce-setup.log) 2>&1',
      '',
      '# === System Setup ===',
      'export DEBIAN_FRONTEND=noninteractive',
      'apt-get update -y',
      'apt-get upgrade -y',
      '',
      '# PoC fix #2: Ubuntu 24.04 uses ssh.service (not sshd.service)',
      'sed -i "s/#PasswordAuthentication yes/PasswordAuthentication no/" /etc/ssh/sshd_config',
      'sed -i "s/#PermitRootLogin prohibit-password/PermitRootLogin no/" /etc/ssh/sshd_config',
      'systemctl restart ssh.service',
      '',
      '# === Docker Installation ===',
      'apt-get install -y ca-certificates curl gnupg',
      'install -m 0755 -d /etc/apt/keyrings',
      'curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg',
      'chmod a+r /etc/apt/keyrings/docker.gpg',
      'echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null',
      'apt-get update -y',
      'apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin',
      'usermod -aG docker ubuntu',
      '',
      '# === OpenClaw Deployment (build from source) ===',
      'apt-get install -y git',
      'su - ubuntu -c "git clone --depth 1 https://github.com/openclaw/openclaw.git ~/openclaw-src"',
      '',
      '# Build Docker image from source',
      'su - ubuntu -c "cd ~/openclaw-src && docker build -t openclaw:local -f Dockerfile ."',
      '',
      '# Create deployment directory with custom compose file',
      'mkdir -p /home/ubuntu/openclaw',
      '',
      '# Custom docker-compose.yml (standalone, no external env vars needed)',
      `# PoC fix #10: Docker Compose override with AWS_REGION`,
      `# PoC fix #5: Bedrock Inference Profile format model ID`,
      'GATEWAY_TOKEN=$(openssl rand -hex 32)',
      '',
      '# PoC fix #7/#8/#9: Pre-create OpenClaw config (gateway.mode=local + allowedOrigins + token)',
      'mkdir -p /home/ubuntu/openclaw/config /home/ubuntu/openclaw/workspace',
      'cat > /home/ubuntu/openclaw/config/openclaw.json << OCCONFIG',
      '{',
      '  "gateway": {',
      '    "mode": "local",',
      '    "auth": { "token": "${GATEWAY_TOKEN}" },',
      '    "controlUi": { "allowedOrigins": ["*"] }',
      '  }',
      '}',
      'OCCONFIG',
      '',
      '# Create docker-compose.yml with bind mount to pre-configured directory',
      'cat > /home/ubuntu/openclaw/docker-compose.yml << COMPOSE',
      'services:',
      '  openclaw-gateway:',
      '    image: openclaw:local',
      '    environment:',
      '      HOME: /home/node',
      '      TERM: xterm-256color',
      `      AWS_REGION: ${bedrockRegion}`,
      `      AWS_DEFAULT_REGION: ${bedrockRegion}`,
      `      OPENCLAW_MODEL: ${bedrockModelId}`,
      '    volumes:',
      '      - /home/ubuntu/openclaw/config:/home/node/.openclaw',
      '      - /home/ubuntu/openclaw/workspace:/home/node/.openclaw/workspace',
      '    ports:',
      '      - "18789:18789"',
      '      - "18790:18790"',
      '    init: true',
      '    restart: unless-stopped',
      '    command: ["node", "dist/index.js", "gateway", "--bind", "lan", "--port", "18789"]',
      'COMPOSE',
      '',
      'chown -R 1000:1000 /home/ubuntu/openclaw/config /home/ubuntu/openclaw/workspace',
      'chown -R ubuntu:ubuntu /home/ubuntu/openclaw/docker-compose.yml',
      '',
      '# Save gateway token for reference',
      'echo "${GATEWAY_TOKEN}" > /home/ubuntu/openclaw/.gateway-token',
      'chown ubuntu:ubuntu /home/ubuntu/openclaw/.gateway-token',
      'chmod 600 /home/ubuntu/openclaw/.gateway-token',
      '',
      '# === UFW Firewall ===',
      'ufw allow 22/tcp',
      'ufw allow 18789/tcp',
      'ufw allow 18790/tcp',
      'ufw allow 18791/tcp',
      'ufw --force enable',
      '',
      '# === Start OpenClaw ===',
      'su - ubuntu -c "cd ~/openclaw && docker compose up -d"',
      '',
      '# === CloudWatch Agent ===',
      'wget -q https://amazoncloudwatch-agent.s3.amazonaws.com/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb -O /tmp/amazon-cloudwatch-agent.deb',
      'dpkg -i /tmp/amazon-cloudwatch-agent.deb',
      'rm /tmp/amazon-cloudwatch-agent.deb',
      ...(props.cloudWatchAgentConfig ? [
        `cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << 'CWAGENT'`,
        props.cloudWatchAgentConfig,
        'CWAGENT',
        '/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json',
      ] : [
        'echo "CloudWatch Agent config not provided, skipping"',
      ]),
      '',
      'echo "ClawForce OpenClaw setup complete at $(date)"',
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
