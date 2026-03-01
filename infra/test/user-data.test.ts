import { buildUserDataCommands } from '../lib/constructs/user-data';

describe('buildUserDataCommands', () => {
  const defaultParams = {
    bedrockRegion: 'us-east-1',
    bedrockModelId: 'us.anthropic.claude-sonnet-4-6',
    gatewayToken: 'test-token-123',
  };

  test('starts with bash shebang and error handling', () => {
    const commands = buildUserDataCommands(defaultParams);
    expect(commands[0]).toBe('#!/bin/bash');
    expect(commands[1]).toBe('set -euo pipefail');
  });

  test('includes SSH hardening commands', () => {
    const commands = buildUserDataCommands(defaultParams);
    const joined = commands.join('\n');
    expect(joined).toContain('PasswordAuthentication no');
    expect(joined).toContain('PermitRootLogin no');
    expect(joined).toContain('systemctl restart ssh.service');
  });

  test('includes Docker installation', () => {
    const commands = buildUserDataCommands(defaultParams);
    const joined = commands.join('\n');
    expect(joined).toContain('docker-ce');
    expect(joined).toContain('docker-compose-plugin');
  });

  test('includes OpenClaw clone and build', () => {
    const commands = buildUserDataCommands(defaultParams);
    const joined = commands.join('\n');
    expect(joined).toContain('git clone --depth 1');
    expect(joined).toContain('docker build -t openclaw:local');
  });

  test('injects bedrockRegion into .env and Bedrock baseUrl', () => {
    const commands = buildUserDataCommands({
      ...defaultParams,
      bedrockRegion: 'ap-northeast-1',
    });
    const joined = commands.join('\n');
    expect(joined).toContain('AWS_REGION=ap-northeast-1');
    expect(joined).toContain('AWS_DEFAULT_REGION=ap-northeast-1');
    expect(joined).toContain('bedrock-runtime.ap-northeast-1.amazonaws.com');
  });

  test('generates Bedrock provider config in openclaw.json', () => {
    const commands = buildUserDataCommands(defaultParams);
    const joined = commands.join('\n');
    expect(joined).toContain('"api": "bedrock-converse-stream"');
    expect(joined).toContain('"auth": "aws-sdk"');
    expect(joined).toContain('"amazon-bedrock"');
    expect(joined).toContain('bedrock-runtime.us-east-1.amazonaws.com');
  });

  test('includes inference profile model IDs in Bedrock provider', () => {
    const commands = buildUserDataCommands(defaultParams);
    const joined = commands.join('\n');
    expect(joined).toContain('us.anthropic.claude-sonnet-4-6');
    expect(joined).toContain('us.anthropic.claude-opus-4-6-v1');
    expect(joined).toContain('us.anthropic.claude-haiku-4-5-20251001-v1:0');
  });

  test('sets agent default model to amazon-bedrock/ inference profile', () => {
    const commands = buildUserDataCommands(defaultParams);
    const joined = commands.join('\n');
    expect(joined).toContain('"primary": "amazon-bedrock/us.anthropic.claude-sonnet-4-6"');
  });

  test('uses custom bedrockModelId for agent default model', () => {
    const commands = buildUserDataCommands({
      ...defaultParams,
      bedrockModelId: 'us.anthropic.claude-opus-4-6-v1',
    });
    const joined = commands.join('\n');
    expect(joined).toContain('"primary": "amazon-bedrock/us.anthropic.claude-opus-4-6-v1"');
  });

  test('includes UFW firewall rules for SSH and Gateway', () => {
    const commands = buildUserDataCommands(defaultParams);
    const joined = commands.join('\n');
    expect(joined).toContain('ufw allow 22/tcp');
    expect(joined).toContain('ufw allow 18789/tcp');
    expect(joined).not.toContain('ufw allow 18790/tcp');
    expect(joined).not.toContain('ufw allow 18791/tcp');
  });

  test('includes CloudWatch Agent install', () => {
    const commands = buildUserDataCommands(defaultParams);
    const joined = commands.join('\n');
    expect(joined).toContain('amazon-cloudwatch-agent.deb');
  });

  test('skips CloudWatch config when not provided', () => {
    const commands = buildUserDataCommands(defaultParams);
    const joined = commands.join('\n');
    expect(joined).toContain('CloudWatch Agent config not provided, skipping');
    expect(joined).not.toContain('fetch-config');
  });

  test('writes CloudWatch config when provided', () => {
    const commands = buildUserDataCommands({
      ...defaultParams,
      cloudWatchAgentConfig: '{"agent":{"metrics_collection_interval":60}}',
    });
    const joined = commands.join('\n');
    expect(joined).toContain('metrics_collection_interval');
    expect(joined).toContain('fetch-config');
    expect(joined).not.toContain('config not provided');
  });

  test('ends with completion message', () => {
    const commands = buildUserDataCommands(defaultParams);
    const last = commands[commands.length - 1];
    expect(last).toContain('ClawForce OpenClaw setup complete');
  });

  test('injects gateway token into .env and openclaw.json', () => {
    const commands = buildUserDataCommands(defaultParams);
    const joined = commands.join('\n');
    expect(joined).toContain('OPENCLAW_GATEWAY_TOKEN=test-token-123');
    expect(joined).toContain('"token": "test-token-123"');
  });

  test('creates OpenClaw config with gateway mode local', () => {
    const commands = buildUserDataCommands(defaultParams);
    const joined = commands.join('\n');
    expect(joined).toContain('"mode": "local"');
  });

  test('reads docker-compose.yml from assets directory', () => {
    const commands = buildUserDataCommands(defaultParams);
    const joined = commands.join('\n');
    expect(joined).toContain('openclaw-gateway');
    expect(joined).toContain('${AWS_REGION}');
  });

  test('writes openclaw.json config directly (no envsubst needed)', () => {
    const commands = buildUserDataCommands(defaultParams);
    const joined = commands.join('\n');
    expect(joined).toContain('openclaw.json');
    expect(joined).toContain('"mode": "local"');
    expect(joined).not.toContain('envsubst');
  });

  test('writes .env file with deployment values', () => {
    const commands = buildUserDataCommands(defaultParams);
    const joined = commands.join('\n');
    expect(joined).toContain('.env');
    expect(joined).toContain('AWS_REGION=us-east-1');
  });

  test('.env does not include OPENCLAW_MODEL (model configured in openclaw.json)', () => {
    const commands = buildUserDataCommands(defaultParams);
    const joined = commands.join('\n');
    expect(joined).not.toContain('OPENCLAW_MODEL=');
  });
});
