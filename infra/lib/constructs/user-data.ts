import * as fs from 'fs';
import * as path from 'path';

/**
 * UserData script builder for ClawForce EC2 instance.
 *
 * Generates the shell commands for instance bootstrap, separated into
 * logical sections for readability and testability.
 *
 * Docker deployment files are read from infra/assets/ at CDK synth time:
 * - assets/docker-compose.yml  (uses ${VAR} with .env file)
 * - assets/openclaw.json       (static config, no envsubst needed)
 *
 * PoC lessons applied:
 * - Ubuntu 24.04 uses ssh.service not sshd.service (#2)
 * - Docker Compose override injects AWS_REGION (#10)
 * - Bedrock uses Inference Profile format model ID (#5)
 * - Pre-create OpenClaw config for gateway.mode=local (#7/#8/#9)
 */

/** Path to the assets directory (resolved relative to this file) */
const ASSETS_DIR = path.resolve(__dirname, '../../assets');

export interface UserDataParams {
  /** AWS region for Bedrock */
  bedrockRegion: string;
  /** Bedrock model ID in Inference Profile format */
  bedrockModelId: string;
  /** Gateway auth token (required by OpenClaw for --bind lan) */
  gatewayToken: string;
  /** CloudWatch Agent config JSON (optional) */
  cloudWatchAgentConfig?: string;
}

/** Build the complete UserData command list */
export function buildUserDataCommands(params: UserDataParams): string[] {
  return [
    ...buildUserDataSetupCommands(params),
    ...startOpenClawCommands(),
    '',
    'echo "ClawForce OpenClaw setup complete at $(date)"',
  ];
}

/**
 * Build setup commands (everything BEFORE docker compose up).
 *
 * Use this when the stack needs to inject additional config (e.g., ALB CORS)
 * between setup and container start. Follow with startOpenClawCommands().
 */
export function buildUserDataSetupCommands(params: UserDataParams): string[] {
  return [
    ...preamble(),
    ...systemSetup(),
    ...dockerInstall(),
    ...openClawDeploy(params.bedrockRegion, params.bedrockModelId, params.gatewayToken),
    ...ufwFirewall(),
    ...cloudWatchAgent(params.cloudWatchAgentConfig),
  ];
}

/** Commands to start the OpenClaw container. Call after all config is written. */
export function startOpenClawCommands(): string[] {
  return startOpenClaw();
}

function preamble(): string[] {
  return [
    '#!/bin/bash',
    'set -euo pipefail',
    'exec > >(tee /var/log/clawforce-setup.log) 2>&1',
    '',
  ];
}

function systemSetup(): string[] {
  return [
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
  ];
}

function dockerInstall(): string[] {
  return [
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
  ];
}

/** Read an asset file at CDK synth time */
function readAsset(filename: string): string {
  return fs.readFileSync(path.join(ASSETS_DIR, filename), 'utf-8');
}

function openClawDeploy(
  bedrockRegion: string,
  bedrockModelId: string,
  gatewayToken: string,
): string[] {
  const composeContent = readAsset('docker-compose.yml');
  const configContent = readAsset('openclaw.json');

  return [
    '# === OpenClaw Deployment (build from source) ===',
    'apt-get install -y git gettext-base',
    'su - ubuntu -c "git clone --depth 1 https://github.com/openclaw/openclaw.git ~/openclaw-src"',
    '',
    '# Build Docker image from source',
    'su - ubuntu -c "cd ~/openclaw-src && docker build -t openclaw:local -f Dockerfile ."',
    '',
    '# Create deployment directory',
    'mkdir -p /home/ubuntu/openclaw/config /home/ubuntu/openclaw/workspace',
    '',
    '# Write OpenClaw config (auth via OPENCLAW_GATEWAY_TOKEN env var in .env)',
    `cat > /home/ubuntu/openclaw/config/openclaw.json << 'OCCONFIG'`,
    configContent.trim(),
    'OCCONFIG',
    '',
    '# Write docker-compose.yml',
    `cat > /home/ubuntu/openclaw/docker-compose.yml << 'COMPOSE'`,
    composeContent.trim(),
    'COMPOSE',
    '',
    `# Write .env with deployment-specific values (PoC fix #10/#5)`,
    `# CR-009 fix: Model ID must use amazon-bedrock/ prefix so OpenClaw routes to`,
    `# Bedrock provider (IAM auth via IMDS) instead of direct Anthropic API (API key).`,
    `cat > /home/ubuntu/openclaw/.env << ENV`,
    `AWS_REGION=${bedrockRegion}`,
    `AWS_DEFAULT_REGION=${bedrockRegion}`,
    `OPENCLAW_MODEL=amazon-bedrock/${bedrockModelId}`,
    `OPENCLAW_GATEWAY_TOKEN=${gatewayToken}`,
    'ENV',
    '',
    '# Set ownership and restrict .env permissions',
    'chown -R 1000:1000 /home/ubuntu/openclaw/config /home/ubuntu/openclaw/workspace',
    'chown -R ubuntu:ubuntu /home/ubuntu/openclaw/docker-compose.yml /home/ubuntu/openclaw/.env',
    'chmod 600 /home/ubuntu/openclaw/.env',
    '',
    '',
  ];
}

function ufwFirewall(): string[] {
  return [
    '# === UFW Firewall ===',
    '# Fix: Docker port mapping requires FORWARD ACCEPT policy (UFW default is DROP)',
    'sed -i \'s/DEFAULT_FORWARD_POLICY="DROP"/DEFAULT_FORWARD_POLICY="ACCEPT"/\' /etc/default/ufw',
    'ufw allow 22/tcp',
    'ufw allow 18789/tcp',
    'ufw --force enable',
    '',
  ];
}

function startOpenClaw(): string[] {
  return ['# === Start OpenClaw ===', 'su - ubuntu -c "cd ~/openclaw && docker compose up -d"', ''];
}

function cloudWatchAgent(configJson?: string): string[] {
  const install = [
    '# === CloudWatch Agent ===',
    'wget -q https://amazoncloudwatch-agent.s3.amazonaws.com/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb -O /tmp/amazon-cloudwatch-agent.deb',
    'dpkg -i /tmp/amazon-cloudwatch-agent.deb',
    'rm /tmp/amazon-cloudwatch-agent.deb',
  ];

  if (configJson) {
    return [
      ...install,
      `cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << 'CWAGENT'`,
      configJson,
      'CWAGENT',
      '/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json',
    ];
  }

  return [...install, 'echo "CloudWatch Agent config not provided, skipping"'];
}
