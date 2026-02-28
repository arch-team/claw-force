import * as cdk from 'aws-cdk-lib/core';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { ClawForceIam } from '../lib/constructs/iam';

describe('ClawForceIam', () => {
  let template: Template;

  beforeAll(() => {
    const stack = new cdk.Stack();
    new ClawForceIam(stack, 'Iam', { bedrockRegion: 'us-east-1' });
    template = Template.fromStack(stack);
  });

  test('creates IAM role with EC2 service principal', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Principal: { Service: 'ec2.amazonaws.com' },
          }),
        ]),
      }),
    });
  });

  test('grants Bedrock InvokeModel permissions', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
            Effect: 'Allow',
          }),
        ]),
      }),
    });
  });

  test('includes inference-profile ARN in Bedrock resources', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
            Resource: Match.arrayWith(['arn:aws:bedrock:us-east-1::foundation-model/*']),
          }),
        ]),
      }),
    });
  });

  test('grants Bedrock model listing permissions', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: [
              'bedrock:ListFoundationModels',
              'bedrock:ListInferenceProfiles',
              'bedrock:GetFoundationModel',
            ],
            Effect: 'Allow',
            Resource: '*',
          }),
        ]),
      }),
    });
  });

  test('attaches CloudWatch Agent managed policy', () => {
    const roles = template.findResources('AWS::IAM::Role');
    const role = Object.values(roles)[0];
    const managedPolicies = JSON.stringify(role.Properties.ManagedPolicyArns);
    expect(managedPolicies).toContain('CloudWatchAgentServerPolicy');
  });

  test('creates instance profile', () => {
    template.resourceCountIs('AWS::IAM::InstanceProfile', 1);
  });
});
