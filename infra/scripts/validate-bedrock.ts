#!/usr/bin/env npx tsx
/**
 * Pre-deploy Bedrock model validation script.
 *
 * Checks that the configured Bedrock model is available in the target region.
 * Uses ListFoundationModels API to verify model existence.
 *
 * Usage:
 *   npx tsx scripts/validate-bedrock.ts
 *   npm run validate
 */

import {
  BedrockClient,
  ListFoundationModelsCommand,
} from '@aws-sdk/client-bedrock';
import { readFileSync } from 'fs';
import { resolve } from 'path';

interface CdkContext {
  bedrockRegion?: string;
  bedrockModelId?: string;
  [key: string]: unknown;
}

// Bedrock model presets for quick reference
const MODEL_PRESETS: Record<string, { name: string; inferenceProfileId: string }> = {
  'claude-haiku-4-5': {
    name: 'Claude Haiku 4.5',
    inferenceProfileId: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
  },
  'claude-sonnet-4-5': {
    name: 'Claude Sonnet 4.5',
    inferenceProfileId: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
  },
  'claude-opus-4-5': {
    name: 'Claude Opus 4.5',
    inferenceProfileId: 'us.anthropic.claude-opus-4-5-20251101-v1:0',
  },
};

function loadCdkContext(): CdkContext {
  const cdkJsonPath = resolve(__dirname, '..', 'cdk.json');
  const cdkJson = JSON.parse(readFileSync(cdkJsonPath, 'utf-8'));
  return cdkJson.context ?? {};
}

/**
 * Extract the foundation model ID from an Inference Profile format ID.
 * Example: "us.anthropic.claude-sonnet-4-5-20250929-v1:0" -> "anthropic.claude-sonnet-4-5-20250929-v1:0"
 */
function extractFoundationModelId(inferenceProfileId: string): string {
  // Inference Profile format: {region-prefix}.{provider}.{model}
  // Foundation model format: {provider}.{model}
  const parts = inferenceProfileId.split('.');
  if (parts.length >= 3) {
    return parts.slice(1).join('.');
  }
  return inferenceProfileId;
}

async function validateModel(): Promise<void> {
  const context = loadCdkContext();
  const region = context.bedrockRegion ?? 'us-east-1';
  const configuredModel = context.bedrockModelId ?? MODEL_PRESETS['claude-sonnet-4-5'].inferenceProfileId;

  console.log('=== ClawForce Bedrock Model Validation ===\n');
  console.log(`Region:           ${region}`);
  console.log(`Configured Model: ${configuredModel}`);

  const foundationModelId = extractFoundationModelId(configuredModel);
  console.log(`Foundation Model: ${foundationModelId}\n`);

  try {
    const client = new BedrockClient({ region });
    const response = await client.send(
      new ListFoundationModelsCommand({
        byProvider: foundationModelId.split('.')[0], // e.g., "anthropic"
      }),
    );

    const models = response.modelSummaries ?? [];
    const matchedModel = models.find((m) => m.modelId === foundationModelId);

    if (matchedModel) {
      console.log('--- Validation Result ---');
      console.log(`Status:       AVAILABLE`);
      console.log(`Model Name:   ${matchedModel.modelName}`);
      console.log(`Model ID:     ${matchedModel.modelId}`);
      console.log(`Provider:     ${matchedModel.providerName}`);
      console.log(`Input Modes:  ${matchedModel.inputModalities?.join(', ')}`);
      console.log(`Output Modes: ${matchedModel.outputModalities?.join(', ')}`);
      console.log(`Streaming:    ${matchedModel.responseStreamingSupported ? 'Yes' : 'No'}`);
      console.log('\nReady to deploy with this model.');
    } else {
      console.log('--- Validation Result ---');
      console.log(`Status: NOT FOUND`);
      console.log(`\nModel "${foundationModelId}" not found in ${region}.`);
      console.log('\nAvailable Anthropic models in this region:');
      models.forEach((m) => {
        console.log(`  - ${m.modelId} (${m.modelName})`);
      });
      console.log('\nAvailable presets:');
      Object.entries(MODEL_PRESETS).forEach(([key, preset]) => {
        console.log(`  - ${key}: ${preset.inferenceProfileId} (${preset.name})`);
      });
      process.exitCode = 1;
    }
  } catch (error: unknown) {
    const err = error as Error & { name?: string };
    if (err.name === 'CredentialsProviderError' || err.name === 'ExpiredTokenException') {
      console.log('--- Validation Result ---');
      console.log('Status: SKIPPED (no AWS credentials)');
      console.log('\nAWS credentials not configured. To validate:');
      console.log('  1. Configure AWS CLI: aws configure');
      console.log('  2. Or set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY');
      console.log('  3. Or use AWS SSO: aws sso login');
      console.log('\nSkipping model validation. Deploy will validate at runtime.');
    } else {
      console.error('--- Validation Error ---');
      console.error(`Error: ${err.message}`);
      process.exitCode = 1;
    }
  }
}

validateModel();
