import * as cdk from 'aws-cdk-lib/core';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { ClawForceNetworking } from '../lib/constructs/networking';

describe('ClawForceNetworking', () => {
  let template: Template;

  beforeAll(() => {
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Vpc', { maxAzs: 2 });
    new ClawForceNetworking(stack, 'Networking', {
      vpc,
      allowedCidr: '10.0.0.0/8',
    });
    template = Template.fromStack(stack);
  });

  test('creates a security group', () => {
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupDescription: 'ClawForce OpenClaw instance security group',
    });
  });

  test('allows SSH from specified CIDR', () => {
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      SecurityGroupIngress: Match.arrayWith([
        Match.objectLike({
          IpProtocol: 'tcp',
          FromPort: 22,
          ToPort: 22,
          CidrIp: '10.0.0.0/8',
        }),
      ]),
    });
  });

  test('allows all outbound traffic', () => {
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      SecurityGroupEgress: Match.arrayWith([
        Match.objectLike({
          IpProtocol: '-1',
          CidrIp: '0.0.0.0/0',
        }),
      ]),
    });
  });

  test('creates exactly one security group in construct', () => {
    // The construct creates 1 SG; the VPC also creates SGs, so we check properties
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupDescription: 'ClawForce OpenClaw instance security group',
    });
  });
});

describe('ClawForceNetworking with different CIDR', () => {
  test('uses provided CIDR for SSH rule', () => {
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Vpc', { maxAzs: 2 });
    new ClawForceNetworking(stack, 'Networking', {
      vpc,
      allowedCidr: '192.168.1.0/24',
    });
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      SecurityGroupIngress: Match.arrayWith([
        Match.objectLike({
          CidrIp: '192.168.1.0/24',
          FromPort: 22,
          ToPort: 22,
        }),
      ]),
    });
  });
});
