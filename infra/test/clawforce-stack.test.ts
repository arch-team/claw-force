import { Template, Match } from 'aws-cdk-lib/assertions';
import { ClawForceStack } from '../lib/clawforce-stack';
import { createTestApp, TEST_ACCOUNT, TEST_REGION } from './test-helpers';

describe('ClawForceStack - ALB mode (default)', () => {
  let template: Template;

  beforeAll(() => {
    const app = createTestApp();
    const stack = new ClawForceStack(app, 'TestAlbStack', {
      env: { account: TEST_ACCOUNT, region: TEST_REGION },
    });
    template = Template.fromStack(stack);
  });

  test('creates EC2 instance', () => {
    template.resourceCountIs('AWS::EC2::Instance', 1);
  });

  test('creates two security groups (instance + ALB)', () => {
    template.resourceCountIs('AWS::EC2::SecurityGroup', 2);
  });

  test('creates internet-facing ALB', () => {
    template.resourceCountIs('AWS::ElasticLoadBalancingV2::LoadBalancer', 1);
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::LoadBalancer', {
      Scheme: 'internet-facing',
      Name: 'ClawForce-ALB',
    });
  });

  test('creates three target groups for OpenClaw services', () => {
    template.resourceCountIs('AWS::ElasticLoadBalancingV2::TargetGroup', 3);
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
      Port: 18789,
      Name: 'ClawForce-Gateway',
    });
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
      Port: 18790,
      Name: 'ClawForce-ControlUI',
    });
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
      Port: 18791,
      Name: 'ClawForce-Browser',
    });
  });

  test('creates WAF WebACL with REGIONAL scope', () => {
    template.resourceCountIs('AWS::WAFv2::WebACL', 1);
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      Scope: 'REGIONAL',
      DefaultAction: { Allow: {} },
    });
  });

  test('associates WAF with ALB', () => {
    template.resourceCountIs('AWS::WAFv2::WebACLAssociation', 1);
  });

  test('creates CloudWatch log groups', () => {
    template.resourceCountIs('AWS::Logs::LogGroup', 2);
  });

  test('creates CloudWatch alarms', () => {
    template.resourceCountIs('AWS::CloudWatch::Alarm', 2);
  });

  test('creates IAM role and instance profiles', () => {
    template.resourceCountIs('AWS::IAM::Role', 1);
    // 2 InstanceProfiles: one explicit in IAM construct + one auto-created by ec2.Instance
    template.resourceCountIs('AWS::IAM::InstanceProfile', 2);
  });

  test('enforces IMDSv2 hop limit 2 for Docker container access', () => {
    // CDK puts HttpTokens in LaunchTemplate, HttpPutResponseHopLimit on Instance via override
    template.hasResourceProperties('AWS::EC2::Instance', {
      MetadataOptions: Match.objectLike({
        HttpPutResponseHopLimit: 2,
      }),
    });
    // requireImdsv2 creates a LaunchTemplate with HttpTokens
    template.resourceCountIs('AWS::EC2::LaunchTemplate', 1);
  });

  test('uses encrypted GP3 EBS volume', () => {
    template.hasResourceProperties('AWS::EC2::Instance', {
      BlockDeviceMappings: Match.arrayWith([
        Match.objectLike({
          Ebs: Match.objectLike({
            VolumeType: 'gp3',
            Encrypted: true,
          }),
        }),
      ]),
    });
  });

  test('outputs ALB DNS name', () => {
    template.hasOutput('AlbDnsName', {});
  });

  test('outputs Control UI URL via ALB', () => {
    template.hasOutput('ControlUiUrl', {});
  });
});

describe('ClawForceStack - direct mode (enableAlb=false)', () => {
  let template: Template;

  beforeAll(() => {
    const app = createTestApp();
    const stack = new ClawForceStack(app, 'TestDirectStack', {
      env: { account: TEST_ACCOUNT, region: TEST_REGION },
      enableAlb: false,
    });
    template = Template.fromStack(stack);
  });

  test('creates EC2 instance', () => {
    template.resourceCountIs('AWS::EC2::Instance', 1);
  });

  test('creates only one security group (instance only)', () => {
    template.resourceCountIs('AWS::EC2::SecurityGroup', 1);
  });

  test('does not create ALB', () => {
    template.resourceCountIs('AWS::ElasticLoadBalancingV2::LoadBalancer', 0);
  });

  test('does not create WAF', () => {
    template.resourceCountIs('AWS::WAFv2::WebACL', 0);
  });

  test('still creates CloudWatch log groups', () => {
    template.resourceCountIs('AWS::Logs::LogGroup', 2);
  });

  test('still creates CloudWatch alarms', () => {
    template.resourceCountIs('AWS::CloudWatch::Alarm', 2);
  });

  test('outputs Gateway WebSocket URL with port', () => {
    template.hasOutput('GatewayUrl', {});
  });
});
