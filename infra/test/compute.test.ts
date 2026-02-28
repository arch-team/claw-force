import * as cdk from 'aws-cdk-lib/core';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { ClawForceCompute } from '../lib/constructs/compute';

function createComputeStack(overrides: Partial<ConstructorParameters<typeof ClawForceCompute>[2]> = {}) {
  const app = new cdk.App({
    context: {
      'ami:account=123456789012:filters.image-type.0=machine:filters.name.0=ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*:filters.state.0=available:owners.0=099720109477:region=us-east-1':
        'ami-test12345',
    },
  });
  const stack = new cdk.Stack(app, 'TestStack', {
    env: { account: '123456789012', region: 'us-east-1' },
  });
  const vpc = ec2.Vpc.fromVpcAttributes(stack, 'Vpc', {
    vpcId: 'vpc-12345',
    availabilityZones: ['us-east-1a', 'us-east-1b'],
    publicSubnetIds: ['subnet-111', 'subnet-222'],
  });
  const sg = new ec2.SecurityGroup(stack, 'SG', { vpc });
  const role = new iam.Role(stack, 'Role', {
    assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
  });

  new ClawForceCompute(stack, 'Compute', {
    vpc,
    securityGroup: sg,
    role,
    ...overrides,
  });

  return Template.fromStack(stack);
}

describe('ClawForceCompute', () => {
  let template: Template;

  beforeAll(() => {
    template = createComputeStack();
  });

  test('creates an EC2 instance', () => {
    template.resourceCountIs('AWS::EC2::Instance', 1);
  });

  test('uses t3.medium as default instance type', () => {
    template.hasResourceProperties('AWS::EC2::Instance', {
      InstanceType: 't3.medium',
    });
  });

  test('configures encrypted GP3 EBS volume', () => {
    template.hasResourceProperties('AWS::EC2::Instance', {
      BlockDeviceMappings: Match.arrayWith([
        Match.objectLike({
          DeviceName: '/dev/sda1',
          Ebs: Match.objectLike({
            VolumeType: 'gp3',
            Encrypted: true,
          }),
        }),
      ]),
    });
  });

  test('sets default 30GB volume size', () => {
    template.hasResourceProperties('AWS::EC2::Instance', {
      BlockDeviceMappings: Match.arrayWith([
        Match.objectLike({
          Ebs: Match.objectLike({
            VolumeSize: 30,
          }),
        }),
      ]),
    });
  });

  test('enforces IMDSv2 with hop limit 2 for Docker', () => {
    template.hasResourceProperties('AWS::EC2::Instance', {
      MetadataOptions: Match.objectLike({
        HttpPutResponseHopLimit: 2,
      }),
    });
  });

  test('creates LaunchTemplate for IMDSv2 enforcement', () => {
    template.resourceCountIs('AWS::EC2::LaunchTemplate', 1);
  });

  test('sets ASCII-only instance name', () => {
    template.hasResourceProperties('AWS::EC2::Instance', {
      Tags: Match.arrayWith([
        Match.objectLike({
          Key: 'Name',
          Value: 'ClawForce-OpenClaw',
        }),
      ]),
    });
  });
});

describe('ClawForceCompute with custom props', () => {
  test('uses custom instance type', () => {
    const template = createComputeStack({ instanceType: 't3.large' });
    template.hasResourceProperties('AWS::EC2::Instance', {
      InstanceType: 't3.large',
    });
  });

  test('uses custom volume size', () => {
    const template = createComputeStack({ volumeSize: 50 });
    template.hasResourceProperties('AWS::EC2::Instance', {
      BlockDeviceMappings: Match.arrayWith([
        Match.objectLike({
          Ebs: Match.objectLike({
            VolumeSize: 50,
          }),
        }),
      ]),
    });
  });

  test('attaches key pair when provided', () => {
    const template = createComputeStack({ keyPairName: 'my-key' });
    template.hasResourceProperties('AWS::EC2::Instance', {
      KeyName: 'my-key',
    });
  });
});
