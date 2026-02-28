/**
 * UserData script builder for ClawForce EC2 instance.
 *
 * Generates the shell commands for instance bootstrap, separated into
 * logical sections for readability and testability.
 *
 * PoC lessons applied:
 * - Ubuntu 24.04 uses ssh.service not sshd.service (#2)
 * - Docker Compose override injects AWS_REGION (#10)
 * - Bedrock uses Inference Profile format model ID (#5)
 * - Pre-create OpenClaw config for gateway.mode=local (#7/#8/#9)
 */

export interface UserDataParams {
  /** AWS region for Bedrock */
  bedrockRegion: string;
  /** Bedrock model ID in Inference Profile format */
  bedrockModelId: string;
  /** CloudWatch Agent config JSON (optional) */
  cloudWatchAgentConfig?: string;
}

/** Build the complete UserData command list */
export function buildUserDataCommands(params: UserDataParams): string[] {
  return [
    ...preamble(),
    ...systemSetup(),
    ...dockerInstall(),
    ...openClawDeploy(params.bedrockRegion, params.bedrockModelId),
    ...ufwFirewall(),
    ...startOpenClaw(),
    ...cloudWatchAgent(params.cloudWatchAgentConfig),
    '',
    'echo "ClawForce OpenClaw setup complete at $(date)"',
  ];
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

function openClawDeploy(bedrockRegion: string, bedrockModelId: string): string[] {
  return [
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
  ];
}

function ufwFirewall(): string[] {
  return [
    '# === UFW Firewall ===',
    '# Fix: Docker port mapping requires FORWARD ACCEPT policy (UFW default is DROP)',
    'sed -i \'s/DEFAULT_FORWARD_POLICY="DROP"/DEFAULT_FORWARD_POLICY="ACCEPT"/\' /etc/default/ufw',
    'ufw allow 22/tcp',
    'ufw allow 18789/tcp',
    'ufw allow 18790/tcp',
    'ufw allow 18791/tcp',
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
