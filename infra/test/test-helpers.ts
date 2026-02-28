import * as cdk from 'aws-cdk-lib/core';

export const TEST_ACCOUNT = '123456789012';
export const TEST_REGION = 'us-east-1';

/**
 * Create a CDK App with mock VPC and AMI context for testing.
 * Provides the context values that Vpc.fromLookup and MachineImage.lookup need.
 */
export function createTestApp(): cdk.App {
  return new cdk.App({
    context: {
      [`vpc-provider:account=${TEST_ACCOUNT}:filter.isDefault=true:region=${TEST_REGION}:returnAsymmetricSubnets=true`]: {
        vpcId: 'vpc-12345',
        vpcCidrBlock: '10.0.0.0/16',
        ownerAccountId: TEST_ACCOUNT,
        availabilityZones: [],
        subnetGroups: [
          {
            name: 'Public',
            type: 'Public',
            subnets: [
              {
                subnetId: 'subnet-111',
                cidr: '10.0.0.0/24',
                availabilityZone: `${TEST_REGION}a`,
                routeTableId: 'rtb-111',
              },
              {
                subnetId: 'subnet-222',
                cidr: '10.0.1.0/24',
                availabilityZone: `${TEST_REGION}b`,
                routeTableId: 'rtb-222',
              },
            ],
          },
        ],
      },
      [`ami:account=${TEST_ACCOUNT}:filters.image-type.0=machine:filters.name.0=ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*:filters.state.0=available:owners.0=099720109477:region=${TEST_REGION}`]:
        'ami-test12345',
    },
  });
}
