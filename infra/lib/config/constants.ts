/**
 * OpenClaw service port definitions.
 *
 * OpenClaw consolidates Gateway + Control UI on the same port (18789).
 * Browser service binds to 127.0.0.1:18791 (loopback only, not ALB-routable).
 */
export const OPENCLAW_PORTS = {
  /** Gateway + Control UI (consolidated since OpenClaw v1.x) */
  GATEWAY: 18789,
} as const;

/** Default configuration values */
export const DEFAULTS = {
  INSTANCE_TYPE: 't3.medium',
  VOLUME_SIZE: 30,
  BEDROCK_REGION: 'us-east-1',
  BEDROCK_MODEL_ID: 'us.anthropic.claude-sonnet-4-6',
  LOG_RETENTION_DAYS: 30,
  ALLOWED_CIDR: '0.0.0.0/0',
  /**
   * Gateway auth token — required by OpenClaw when binding to LAN.
   * Security is enforced at infra layer (ALB + WAF + SG); this token
   * prevents accidental unauthenticated access if SG rules are relaxed.
   */
  GATEWAY_TOKEN: 'clawforce-gateway-2026',
} as const;
