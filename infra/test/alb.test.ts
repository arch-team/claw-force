import * as cdk from 'aws-cdk-lib/core';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { ClawForceAlb } from '../lib/constructs/alb';

function createAlbStack(certificateArn?: string) {
  const stack = new cdk.Stack();
  const vpc = new ec2.Vpc(stack, 'Vpc', { maxAzs: 2 });
  const instance = new ec2.Instance(stack, 'Instance', {
    vpc,
    instanceType: new ec2.InstanceType('t3.micro'),
    machineImage: ec2.MachineImage.latestAmazonLinux2023(),
  });

  new ClawForceAlb(stack, 'Alb', {
    vpc,
    instance,
    certificateArn,
  });

  return Template.fromStack(stack);
}

describe('ClawForceAlb - HTTP mode (no certificate)', () => {
  let template: Template;

  beforeAll(() => {
    template = createAlbStack();
  });

  test('creates internet-facing ALB', () => {
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::LoadBalancer', {
      Scheme: 'internet-facing',
      Name: 'ClawForce-ALB',
    });
  });

  test('creates ALB security group with HTTP and HTTPS ingress', () => {
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupDescription: 'ClawForce ALB security group - internet facing',
      SecurityGroupIngress: Match.arrayWith([
        Match.objectLike({ FromPort: 80, ToPort: 80, CidrIp: '0.0.0.0/0' }),
        Match.objectLike({ FromPort: 443, ToPort: 443, CidrIp: '0.0.0.0/0' }),
      ]),
    });
  });

  test('creates two target groups for OpenClaw services', () => {
    template.resourceCountIs('AWS::ElasticLoadBalancingV2::TargetGroup', 2);
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
      Port: 18789,
      Name: 'ClawForce-Gateway',
    });
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
      Port: 18789,
      Name: 'ClawForce-ControlUI',
    });
  });

  test('creates HTTP listener on port 80', () => {
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::Listener', {
      Port: 80,
      Protocol: 'HTTP',
    });
  });

  test('configures gateway target group with stickiness', () => {
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
      Name: 'ClawForce-Gateway',
      TargetGroupAttributes: Match.arrayWith([
        Match.objectLike({
          Key: 'stickiness.enabled',
          Value: 'true',
        }),
      ]),
    });
  });

  test('creates path-based routing rule for gateway', () => {
    template.resourceCountIs('AWS::ElasticLoadBalancingV2::ListenerRule', 1);
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::ListenerRule', {
      Priority: 10,
      Conditions: Match.arrayWith([
        Match.objectLike({
          Field: 'path-pattern',
          PathPatternConfig: Match.objectLike({
            Values: ['/ws', '/ws/*'],
          }),
        }),
      ]),
    });
  });

  test('configures health checks for target groups', () => {
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
      Name: 'ClawForce-ControlUI',
      HealthCheckPath: '/',
      HealthCheckPort: '18789',
    });

    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
      Name: 'ClawForce-Gateway',
      HealthCheckPath: '/',
      HealthCheckPort: '18789',
    });
  });
});

describe('ClawForceAlb - HTTPS mode (with certificate)', () => {
  let template: Template;

  beforeAll(() => {
    template = createAlbStack('arn:aws:acm:us-east-1:123456789012:certificate/test-cert-id');
  });

  test('creates HTTPS listener on port 443', () => {
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::Listener', {
      Port: 443,
      Protocol: 'HTTPS',
    });
  });

  test('creates HTTP to HTTPS redirect', () => {
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::Listener', {
      Port: 80,
      Protocol: 'HTTP',
      DefaultActions: Match.arrayWith([
        Match.objectLike({
          Type: 'redirect',
          RedirectConfig: Match.objectLike({
            Protocol: 'HTTPS',
            Port: '443',
            StatusCode: 'HTTP_301',
          }),
        }),
      ]),
    });
  });

  test('attaches certificate to HTTPS listener', () => {
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::Listener', {
      Port: 443,
      Certificates: Match.arrayWith([
        Match.objectLike({
          CertificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/test-cert-id',
        }),
      ]),
    });
  });
});
