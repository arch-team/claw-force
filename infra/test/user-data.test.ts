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

  test('injects bedrockRegion into .env file', () => {
    const commands = buildUserDataCommands({
      ...defaultParams,
      bedrockRegion: 'ap-northeast-1',
    });
    const joined = commands.join('\n');
    expect(joined).toContain('AWS_REGION=ap-northeast-1');
    expect(joined).toContain('AWS_DEFAULT_REGION=ap-northeast-1');
  });

  test('injects bedrockModelId into .env file with amazon-bedrock/ prefix', () => {
    const commands = buildUserDataCommands({
      ...defaultParams,
      bedrockModelId: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    });
    const joined = commands.join('\n');
    expect(joined).toContain(
      'OPENCLAW_MODEL=amazon-bedrock/us.anthropic.claude-haiku-4-5-20251001-v1:0',
    );
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

  test('injects gateway token into .env via OPENCLAW_GATEWAY_TOKEN', () => {
    const commands = buildUserDataCommands(defaultParams);
    const joined = commands.join('\n');
    expect(joined).toContain('OPENCLAW_GATEWAY_TOKEN=test-token-123');
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

  test('openclaw.json does not include invalid models.providers section', () => {
    const commands = buildUserDataCommands(defaultParams);
    const joined = commands.join('\n');
    expect(joined).not.toContain('"amazon-bedrock"');
  });

  test('writes .env file with deployment values', () => {
    const commands = buildUserDataCommands(defaultParams);
    const joined = commands.join('\n');
    expect(joined).toContain('.env');
    expect(joined).toContain('AWS_REGION=us-east-1');
  });

  test('installs gettext-base for envsubst', () => {
    const commands = buildUserDataCommands(defaultParams);
    const joined = commands.join('\n');
    expect(joined).toContain('gettext-base');
  });
});
