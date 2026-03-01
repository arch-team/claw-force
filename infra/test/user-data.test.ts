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

  test('includes Docker installation', () => {
    expect(joined).toContain('docker-ce');
    expect(joined).toContain('docker-compose-plugin');
  });

  test('includes OpenClaw clone and build', () => {
    expect(joined).toContain('git clone --depth 1');
    expect(joined).toContain('docker build -t openclaw:local');
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

  test('reads docker-compose.yml from assets directory', () => {
    expect(joined).toContain('openclaw-gateway');
    expect(joined).toContain('${AWS_REGION}');
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
