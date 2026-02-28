import * as cdk from 'aws-cdk-lib/core';

/**
 * OpenClaw service port definitions.
 *
 * Note: OpenClaw consolidates Control UI into the Gateway port (18789).
 * Browser service binds to 127.0.0.1:18791 (loopback only, not ALB-routable).
 */
export const OPENCLAW_PORTS = {
  GATEWAY: 18789,
  /** Control UI is served on the Gateway port (OpenClaw consolidated since v1.x) */
  CONTROL_UI: 18789,
  /** Browser binds to 127.0.0.1 only — not routable from ALB */
  BROWSER: 18791,
} as const;

/** Default configuration values */
export const DEFAULTS = {
  INSTANCE_TYPE: 't3.medium',
  VOLUME_SIZE: 30,
  BEDROCK_REGION: 'us-east-1',
  BEDROCK_MODEL_ID: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
  LOG_RETENTION_DAYS: 30,
  ALLOWED_CIDR: '0.0.0.0/0',
} as const;

/** Required resource tags for cost tracking */
export function getRequiredTags(envName: string): Record<string, string> {
  return {
    Project: 'clawforce',
    Environment: envName,
    ManagedBy: 'cdk',
  };
}

/** RemovalPolicy based on environment */
export function getRemovalPolicy(envName: string): cdk.RemovalPolicy {
  return envName === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;
}
