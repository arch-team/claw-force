import * as fs from 'fs';
import * as path from 'path';
import { OPENCLAW_PORTS, BEDROCK_PROVIDER_KEY } from '../config/constants';

/**
 * UserData script builder for ClawForce EC2 instance.
 *
 * Generates the shell commands for instance bootstrap, separated into
 * logical sections for readability and testability.
 *
 * Docker deployment files:
 * - assets/docker-compose.yml  (read at CDK synth time, uses ${VAR} with .env file)
 * - openclaw.json              (generated dynamically with Bedrock provider config)
 *
 * PoC lessons applied:
 * - Ubuntu 24.04 uses ssh.service not sshd.service (#2)
 * - Docker Compose override injects AWS_REGION (#10)
 * - Bedrock uses Inference Profile format model ID (#5)
 * - Pre-create OpenClaw config for gateway.mode=local (#7/#8/#9)
 */

/** Path to the assets directory (resolved relative to this file) */
const ASSETS_DIR = path.resolve(__dirname, '../../assets');

/** Feishu channel configuration for OpenClaw */
export interface FeishuConfig {
  /** Feishu App ID from Feishu Open Platform (format: cli_xxx) */
  readonly appId: string;
  /** Feishu App Secret */
  readonly appSecret: string;
  /** Connection mode: 'websocket' (default, no public URL needed) or 'webhook' */
  readonly connectionMode?: 'websocket' | 'webhook';
  /** Verification token (required for webhook mode) */
  readonly verificationToken?: string;
  /** Encrypt key for encrypted event payloads (optional) */
  readonly encryptKey?: string;
}

export interface UserDataParams {
  /** AWS region for Bedrock */
  readonly bedrockRegion: string;
  /** Bedrock model ID in Inference Profile format (e.g. us.anthropic.claude-sonnet-4-6) */
  readonly bedrockModelId: string;
  /** Gateway auth token (required by OpenClaw for --bind lan) */
  readonly gatewayToken: string;
  /** CloudWatch Agent config JSON (optional) */
  readonly cloudWatchAgentConfig?: string;
  /** Feishu channel config — omit to disable Feishu integration */
  readonly feishu?: FeishuConfig;
  /** Hooks API token — omit to disable hooks endpoint (POST /hooks/agent) */
  readonly hooksToken?: string;
}

/** Bedrock model presets for OpenClaw provider catalog */
const BEDROCK_MODELS = [
  {
    id: 'us.anthropic.claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6 (Bedrock)',
    reasoning: true,
    input: ['text', 'image'],
    contextWindow: 200000,
    maxTokens: 8192,
  },
  {
    id: 'us.anthropic.claude-opus-4-6-v1',
    name: 'Claude Opus 4.6 (Bedrock)',
    reasoning: true,
    input: ['text', 'image'],
    contextWindow: 200000,
    maxTokens: 8192,
  },
  {
    id: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    name: 'Claude Haiku 4.5 (Bedrock)',
    reasoning: false,
    input: ['text', 'image'],
    contextWindow: 200000,
    maxTokens: 8192,
  },
];

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
    ...openClawDeploy(params),
    ...ufwFirewall(),
    ...cloudWatchAgent(params.cloudWatchAgentConfig),
  ];
}

/**
 * Build the shell commands that patch openclaw.json with ALB CORS origin
 * and trusted proxy CIDR. Runs at deploy time via IMDSv2.
 */
export function buildAlbCorsCommands(albDns: string, protocol: string): string[] {
  return [
    '# === Configure Gateway for ALB mode (CR-008) ===',
    `export ALB_ORIGIN="${protocol}://${albDns}"`,
    '# IMDSv2: get token first, then query VPC CIDR',
    'IMDS_TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")',
    'export VPC_CIDR=$(curl -s -H "X-aws-ec2-metadata-token: $IMDS_TOKEN" http://169.254.169.254/latest/meta-data/network/interfaces/macs/$(curl -s -H "X-aws-ec2-metadata-token: $IMDS_TOKEN" http://169.254.169.254/latest/meta-data/mac)/vpc-ipv4-cidr-block)',
    "python3 << 'PYEOF'",
    'import json, os',
    'cfg_path = "/home/ubuntu/openclaw/config/openclaw.json"',
    'with open(cfg_path) as f:',
    '    cfg = json.load(f)',
    'cfg["gateway"]["controlUi"]["allowedOrigins"] = [os.environ["ALB_ORIGIN"]]',
    'cfg["gateway"]["trustedProxies"] = [os.environ.get("VPC_CIDR", "172.31.0.0/16")]',
    'with open(cfg_path, "w") as f:',
    '    json.dump(cfg, f, indent=2)',
    'PYEOF',
  ];
}

/** Commands to start the OpenClaw container. Call after all config is written. */
export function startOpenClawCommands(): string[] {
  return ['# === Start OpenClaw ===', 'su - ubuntu -c "cd ~/openclaw && docker compose up -d"', ''];
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
    'apt-get update -y',
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

/**
 * Generate the complete openclaw.json config at CDK synth time.
 *
 * Includes Bedrock provider config (api, auth, models), agent defaults,
 * and optional Feishu channel + hooks API configuration.
 * The ALB CORS script in clawforce-stack.ts patches allowedOrigins and
 * trustedProxies at deploy time — all other fields are final here.
 */
function buildOpenClawConfig(params: {
  bedrockRegion: string;
  bedrockModelId: string;
  gatewayToken: string;
  feishu?: FeishuConfig;
  hooksToken?: string;
}): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config: Record<string, any> = {
    gateway: {
      mode: 'local',
      auth: { token: params.gatewayToken },
      controlUi: {
        // Placeholder — ALB mode overwrites with concrete origin before docker start.
        // Direct mode keeps this; OpenClaw rejects "*" so direct mode uses instance IP.
        allowedOrigins: ['*'],
        dangerouslyDisableDeviceAuth: true,
      },
    },
    models: {
      providers: {
        [BEDROCK_PROVIDER_KEY]: {
          baseUrl: `https://bedrock-runtime.${params.bedrockRegion}.amazonaws.com`,
          api: 'bedrock-converse-stream',
          auth: 'aws-sdk',
          models: BEDROCK_MODELS,
        },
      },
    },
    agents: {
      defaults: {
        model: {
          primary: `${BEDROCK_PROVIDER_KEY}/${params.bedrockModelId}`,
        },
      },
    },
  };

  // Feishu channel (WebSocket mode by default — no public URL needed)
  if (params.feishu) {
    const feishuChannel: Record<string, unknown> = {
      enabled: true,
      appId: params.feishu.appId,
      appSecret: params.feishu.appSecret,
      connectionMode: params.feishu.connectionMode ?? 'websocket',
      dmPolicy: 'pairing',
      groupPolicy: 'allowlist',
      requireMention: true,
      streaming: true,
    };
    if (params.feishu.verificationToken) {
      feishuChannel.verificationToken = params.feishu.verificationToken;
    }
    if (params.feishu.encryptKey) {
      feishuChannel.encryptKey = params.feishu.encryptKey;
    }
    config.channels = { feishu: feishuChannel };
  }

  // Hooks API for external integrations (POST /hooks/agent)
  if (params.hooksToken) {
    config.hooks = {
      enabled: true,
      token: params.hooksToken,
      defaultSessionKey: 'hook:ingress',
    };
  }

  return JSON.stringify(config, null, 2);
}

function openClawDeploy(params: UserDataParams): string[] {
  const composeContent = fs.readFileSync(path.join(ASSETS_DIR, 'docker-compose.yml'), 'utf-8');
  const configJson = buildOpenClawConfig({
    bedrockRegion: params.bedrockRegion,
    bedrockModelId: params.bedrockModelId,
    gatewayToken: params.gatewayToken,
    feishu: params.feishu,
    hooksToken: params.hooksToken,
  });

  return [
    '# === OpenClaw Deployment (build from source) ===',
    'apt-get install -y git gettext-base',
    'su - ubuntu -c "git clone --depth 1 https://github.com/openclaw/openclaw.git ~/openclaw-src"',
    '',
    '# Build Docker image from source',
    'su - ubuntu -c "cd ~/openclaw-src && docker build -t openclaw:local -f Dockerfile ."',
    '',
    '# Create deployment directory',
    'mkdir -p /home/ubuntu/openclaw/config /home/ubuntu/openclaw/workspace /home/ubuntu/openclaw/logs',
    '',
    '# Write OpenClaw config with Bedrock provider (api: bedrock-converse-stream, auth: aws-sdk)',
    `cat > /home/ubuntu/openclaw/config/openclaw.json << 'OCCONFIG'`,
    configJson,
    'OCCONFIG',
    '',
    '# Write docker-compose.yml',
    `cat > /home/ubuntu/openclaw/docker-compose.yml << 'COMPOSE'`,
    composeContent.trim(),
    'COMPOSE',
    '',
    '# Write .env with deployment-specific values',
    `cat > /home/ubuntu/openclaw/.env << ENV`,
    `AWS_REGION=${params.bedrockRegion}`,
    `AWS_DEFAULT_REGION=${params.bedrockRegion}`,
    `OPENCLAW_GATEWAY_TOKEN=${params.gatewayToken}`,
    'ENV',
    '',
    '# Set ownership and restrict .env permissions',
    'chown -R 1000:1000 /home/ubuntu/openclaw/config /home/ubuntu/openclaw/workspace /home/ubuntu/openclaw/logs',
    'chown -R ubuntu:ubuntu /home/ubuntu/openclaw/docker-compose.yml /home/ubuntu/openclaw/.env',
    'chmod 600 /home/ubuntu/openclaw/.env',
    '',
  ];
}

function ufwFirewall(): string[] {
  return [
    '# === UFW Firewall ===',
    '# Fix: Docker port mapping requires FORWARD ACCEPT policy (UFW default is DROP)',
    'sed -i \'s/DEFAULT_FORWARD_POLICY="DROP"/DEFAULT_FORWARD_POLICY="ACCEPT"/\' /etc/default/ufw',
    'ufw allow 22/tcp',
    `ufw allow ${OPENCLAW_PORTS.GATEWAY}/tcp`,
    'ufw --force enable',
    '',
  ];
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
