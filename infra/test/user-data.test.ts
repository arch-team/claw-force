import { buildUserDataCommands, buildAlbCorsCommands } from '../lib/constructs/user-data';

describe('buildUserDataCommands', () => {
  const defaultParams = {
    bedrockRegion: 'us-east-1',
    bedrockModelId: 'us.anthropic.claude-sonnet-4-6',
    gatewayToken: 'test-token-123',
  };

  // Shared default build — most tests assert against this
  let commands: string[];
  let joined: string;

  beforeAll(() => {
    commands = buildUserDataCommands(defaultParams);
    joined = commands.join('\n');
  });

  test('starts with bash shebang and error handling', () => {
    expect(commands[0]).toBe('#!/bin/bash');
    expect(commands[1]).toBe('set -euo pipefail');
  });

  test('includes SSH hardening commands', () => {
    expect(joined).toContain('PasswordAuthentication no');
    expect(joined).toContain('PermitRootLogin no');
    expect(joined).toContain('systemctl restart ssh.service');
  });

  test('includes Node.js 22 installation via NodeSource', () => {
    expect(joined).toContain('nodesource.com/setup_22.x');
    expect(joined).toContain('apt-get install -y nodejs');
    expect(joined).toContain('corepack enable');
    expect(joined).toContain('corepack prepare pnpm@latest --activate');
  });

  test('includes OpenClaw source clone and pnpm build', () => {
    expect(joined).toContain('git clone --depth 1');
    expect(joined).toContain('pnpm install --frozen-lockfile');
    expect(joined).toContain('pnpm build');
  });

  test('creates systemd service for OpenClaw gateway', () => {
    expect(joined).toContain('openclaw-gateway.service');
    expect(joined).toContain('[Unit]');
    expect(joined).toContain('[Service]');
    expect(joined).toContain(
      'ExecStart=/usr/bin/node dist/index.js gateway --bind lan --port 18789',
    );
    expect(joined).toContain('User=ubuntu');
    expect(joined).toContain('Environment=HOME=/home/ubuntu');
    expect(joined).toContain('Restart=always');
    expect(joined).toContain('EnvironmentFile=/home/ubuntu/openclaw/.env');
    expect(joined).toContain('systemctl daemon-reload');
    expect(joined).toContain('systemctl enable openclaw-gateway');
  });

  test('starts OpenClaw via systemctl', () => {
    expect(joined).toContain('systemctl start openclaw-gateway');
  });

  test('creates symlink from .openclaw to EFS config', () => {
    expect(joined).toContain('ln -sfn /home/ubuntu/openclaw/config /home/ubuntu/.openclaw');
  });

  test('creates /home/node symlink for Docker-era EFS session compatibility', () => {
    expect(joined).toContain('ln -sfn /home/ubuntu /home/node');
  });

  test('does not modify UFW FORWARD policy', () => {
    expect(joined).not.toContain('DEFAULT_FORWARD_POLICY');
    expect(joined).not.toContain('FORWARD');
  });

  test('does not include Docker installation', () => {
    expect(joined).not.toContain('docker-ce');
    expect(joined).not.toContain('docker-compose-plugin');
    expect(joined).not.toContain('docker build');
    expect(joined).not.toContain('docker compose');
  });

  test('injects bedrockRegion into .env and Bedrock baseUrl', () => {
    const customJoined = buildUserDataCommands({
      ...defaultParams,
      bedrockRegion: 'ap-northeast-1',
    }).join('\n');
    expect(customJoined).toContain('AWS_REGION=ap-northeast-1');
    expect(customJoined).toContain('AWS_DEFAULT_REGION=ap-northeast-1');
    expect(customJoined).toContain('bedrock-runtime.ap-northeast-1.amazonaws.com');
  });

  test('generates Bedrock provider config in openclaw.json', () => {
    expect(joined).toContain('"api": "bedrock-converse-stream"');
    expect(joined).toContain('"auth": "aws-sdk"');
    expect(joined).toContain('"amazon-bedrock"');
    expect(joined).toContain('bedrock-runtime.us-east-1.amazonaws.com');
  });

  test('includes inference profile model IDs in Bedrock provider', () => {
    expect(joined).toContain('us.anthropic.claude-sonnet-4-6');
    expect(joined).toContain('us.anthropic.claude-opus-4-6-v1');
    expect(joined).toContain('us.anthropic.claude-haiku-4-5-20251001-v1:0');
  });

  test('sets agent default model to amazon-bedrock/ inference profile', () => {
    expect(joined).toContain('"primary": "amazon-bedrock/us.anthropic.claude-sonnet-4-6"');
  });

  test('uses custom bedrockModelId for agent default model', () => {
    const customJoined = buildUserDataCommands({
      ...defaultParams,
      bedrockModelId: 'us.anthropic.claude-opus-4-6-v1',
    }).join('\n');
    expect(customJoined).toContain('"primary": "amazon-bedrock/us.anthropic.claude-opus-4-6-v1"');
  });

  test('includes UFW firewall rules for SSH and Gateway', () => {
    expect(joined).toContain('ufw allow 22/tcp');
    expect(joined).toContain('ufw allow 18789/tcp');
    expect(joined).not.toContain('ufw allow 18790/tcp');
    expect(joined).not.toContain('ufw allow 18791/tcp');
  });

  test('includes CloudWatch Agent install', () => {
    expect(joined).toContain('amazon-cloudwatch-agent.deb');
  });

  test('skips CloudWatch config when not provided', () => {
    expect(joined).toContain('CloudWatch Agent config not provided, skipping');
    expect(joined).not.toContain('fetch-config');
  });

  test('writes CloudWatch config when provided', () => {
    const customJoined = buildUserDataCommands({
      ...defaultParams,
      cloudWatchAgentConfig: '{"agent":{"metrics_collection_interval":60}}',
    }).join('\n');
    expect(customJoined).toContain('metrics_collection_interval');
    expect(customJoined).toContain('fetch-config');
    expect(customJoined).not.toContain('config not provided');
  });

  test('ends with completion message', () => {
    const last = commands[commands.length - 1];
    expect(last).toContain('ClawForce OpenClaw setup complete');
  });

  test('injects gateway token into .env and openclaw.json', () => {
    expect(joined).toContain('OPENCLAW_GATEWAY_TOKEN=test-token-123');
    expect(joined).toContain('"token": "test-token-123"');
  });

  test('creates OpenClaw config with gateway mode local', () => {
    expect(joined).toContain('"mode": "local"');
  });

  test('writes openclaw.json config directly (no envsubst needed)', () => {
    expect(joined).toContain('openclaw.json');
    expect(joined).toContain('"mode": "local"');
    expect(joined).not.toContain('envsubst');
  });

  test('writes .env file with deployment values', () => {
    expect(joined).toContain('.env');
    expect(joined).toContain('AWS_REGION=us-east-1');
  });

  test('.env does not include OPENCLAW_MODEL (model configured in openclaw.json)', () => {
    expect(joined).not.toContain('OPENCLAW_MODEL=');
  });

  test('does not include Feishu config when not provided', () => {
    expect(joined).not.toContain('"feishu"');
    expect(joined).not.toContain('"channels"');
  });

  test('does not include hooks config when not provided', () => {
    expect(joined).not.toContain('"hooks"');
    expect(joined).not.toContain('hook:ingress');
  });
});

describe('buildUserDataCommands with Feishu', () => {
  const feishuParams = {
    bedrockRegion: 'us-east-1',
    bedrockModelId: 'us.anthropic.claude-sonnet-4-6',
    gatewayToken: 'test-token-123',
    feishu: {
      appId: 'cli_test_feishu_app',
      appSecret: 'test-feishu-secret',
    },
  };

  let joined: string;

  beforeAll(() => {
    joined = buildUserDataCommands(feishuParams).join('\n');
  });

  test('includes Feishu channel config in openclaw.json', () => {
    expect(joined).toContain('"channels"');
    expect(joined).toContain('"feishu"');
  });

  test('sets Feishu appId and appSecret', () => {
    expect(joined).toContain('"appId": "cli_test_feishu_app"');
    expect(joined).toContain('"appSecret": "test-feishu-secret"');
  });

  test('defaults to websocket connection mode', () => {
    expect(joined).toContain('"connectionMode": "websocket"');
  });

  test('enables streaming and open DM by default', () => {
    expect(joined).toContain('"streaming": true');
    expect(joined).toContain('"dmPolicy": "open"');
    expect(joined).toContain('"allowFrom"');
    expect(joined).toContain('"groupPolicy": "allowlist"');
    expect(joined).toContain('"requireMention": true');
  });

  test('does not include verificationToken when not set', () => {
    expect(joined).not.toContain('verificationToken');
  });

  test('includes verificationToken for webhook mode', () => {
    const webhookJoined = buildUserDataCommands({
      ...feishuParams,
      feishu: {
        ...feishuParams.feishu,
        connectionMode: 'webhook' as const,
        verificationToken: 'test-verify-token',
      },
    }).join('\n');
    expect(webhookJoined).toContain('"connectionMode": "webhook"');
    expect(webhookJoined).toContain('"verificationToken": "test-verify-token"');
  });

  test('includes encryptKey when provided', () => {
    const encryptJoined = buildUserDataCommands({
      ...feishuParams,
      feishu: { ...feishuParams.feishu, encryptKey: 'test-encrypt-key' },
    }).join('\n');
    expect(encryptJoined).toContain('"encryptKey": "test-encrypt-key"');
  });

  test('still includes Bedrock provider alongside Feishu config', () => {
    expect(joined).toContain('"api": "bedrock-converse-stream"');
    expect(joined).toContain('"amazon-bedrock"');
  });
});

describe('buildUserDataCommands with hooks', () => {
  test('includes hooks config when token provided', () => {
    const joined = buildUserDataCommands({
      bedrockRegion: 'us-east-1',
      bedrockModelId: 'us.anthropic.claude-sonnet-4-6',
      gatewayToken: 'test-token-123',
      hooksToken: 'test-hooks-token',
    }).join('\n');
    expect(joined).toContain('"hooks"');
    expect(joined).toContain('"enabled": true');
    expect(joined).toContain('"token": "test-hooks-token"');
    expect(joined).toContain('"defaultSessionKey": "hook:ingress"');
  });
});

describe('buildAlbCorsCommands', () => {
  test('includes IMDSv2 token retrieval', () => {
    const joined = buildAlbCorsCommands('my-alb.elb.amazonaws.com', 'https').join('\n');
    expect(joined).toContain('X-aws-ec2-metadata-token-ttl-seconds');
  });

  test('sets ALB_ORIGIN with protocol and DNS', () => {
    const joined = buildAlbCorsCommands('my-alb.elb.amazonaws.com', 'https').join('\n');
    expect(joined).toContain('ALB_ORIGIN="https://my-alb.elb.amazonaws.com"');
  });

  test('uses http protocol when no certificate', () => {
    const joined = buildAlbCorsCommands('my-alb.elb.amazonaws.com', 'http').join('\n');
    expect(joined).toContain('ALB_ORIGIN="http://my-alb.elb.amazonaws.com"');
  });

  test('patches openclaw.json via Python script', () => {
    const joined = buildAlbCorsCommands('test.elb.amazonaws.com', 'https').join('\n');
    expect(joined).toContain('allowedOrigins');
    expect(joined).toContain('trustedProxies');
    expect(joined).toContain('openclaw.json');
  });
});

describe('buildUserDataCommands with EFS', () => {
  const baseParams = {
    bedrockRegion: 'us-east-1',
    bedrockModelId: 'us.anthropic.claude-sonnet-4-6',
    gatewayToken: 'test-token-123',
  };

  test('includes EFS mount commands when efsDnsName is provided', () => {
    const commands = buildUserDataCommands({
      ...baseParams,
      efsDnsName: 'fs-12345.efs.us-west-2.amazonaws.com',
    });
    const joined = commands.join('\n');
    expect(joined).toContain('nfs-common');
    expect(joined).toContain('mount -t nfs4');
    expect(joined).toContain('fs-12345.efs.us-west-2.amazonaws.com');
    expect(joined).toContain('/etc/fstab');
  });

  test('EFS mount appears before OpenClaw config and build', () => {
    const commands = buildUserDataCommands({
      ...baseParams,
      efsDnsName: 'fs-99999.efs.us-east-1.amazonaws.com',
    });
    const joined = commands.join('\n');
    const efsIndex = joined.indexOf('nfs-common');
    const configIndex = joined.indexOf('OpenClaw Config');
    const buildIndex = joined.indexOf('OpenClaw Build');
    expect(efsIndex).toBeGreaterThan(-1);
    expect(configIndex).toBeGreaterThan(-1);
    expect(buildIndex).toBeGreaterThan(-1);
    expect(efsIndex).toBeLessThan(configIndex);
    expect(configIndex).toBeLessThan(buildIndex);
  });

  test('no EFS commands when efsDnsName is omitted', () => {
    const commands = buildUserDataCommands(baseParams);
    const joined = commands.join('\n');
    expect(joined).not.toContain('nfs-common');
    expect(joined).not.toContain('mount -t nfs4');
  });
});
