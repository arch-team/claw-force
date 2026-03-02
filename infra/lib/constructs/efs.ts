import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib/core';
import { NagSuppressions } from 'cdk-nag';

export interface ClawForceEfsProps {
  /** VPC for EFS mount targets */
  readonly vpc: ec2.IVpc;
  /** Instance security group — allowed NFS inbound */
  readonly instanceSecurityGroup: ec2.ISecurityGroup;
  /** Existing EFS filesystem ID to reuse (retained from previous deployment) */
  readonly existingFileSystemId?: string;
}

/**
 * EFS persistent storage for ClawForce OpenClaw data.
 *
 * Provides durable storage that survives EC2 termination and
 * stack destroy/deploy cycles. Conversation history, agent config,
 * and workspace data persist across redeployments.
 *
 * First deploy: no efsFileSystemId → creates new EFS (RETAIN policy).
 * Subsequent: pass efsFileSystemId in CDK context → reimports + recreates mount targets.
 */
export class ClawForceEfs extends Construct {
  public readonly fileSystem: efs.IFileSystem;
  public readonly fileSystemId: string;

  constructor(scope: Construct, id: string, props: ClawForceEfsProps) {
    super(scope, id);

    if (props.existingFileSystemId) {
      // Reimport: reuse EFS retained from previous stack destruction.
      // Mount targets and SG were deleted with the old stack, recreate them.
      const efsSg = new ec2.SecurityGroup(this, 'SecurityGroup', {
        vpc: props.vpc,
        description: 'ClawForce EFS NFS access (reimported)',
        allowAllOutbound: false,
      });
      efsSg.addIngressRule(
        props.instanceSecurityGroup,
        ec2.Port.tcp(2049),
        'NFS from ClawForce EC2',
      );

      props.vpc.publicSubnets.forEach((subnet, i) => {
        new efs.CfnMountTarget(this, `MountTarget${i}`, {
          fileSystemId: props.existingFileSystemId!,
          subnetId: subnet.subnetId,
          securityGroups: [efsSg.securityGroupId],
        });
      });

      this.fileSystem = efs.FileSystem.fromFileSystemAttributes(this, 'FileSystem', {
        fileSystemId: props.existingFileSystemId,
        securityGroup: efsSg,
      });
      this.fileSystemId = props.existingFileSystemId;

      NagSuppressions.addResourceSuppressions(
        efsSg,
        [
          {
            id: 'AwsSolutions-EC23',
            reason: 'EFS SG only allows NFS (2049) from the instance SG, not 0.0.0.0/0',
          },
        ],
        true,
      );
    } else {
      // Create: new EFS with RETAIN so data survives cdk destroy
      const fs = new efs.FileSystem(this, 'FileSystem', {
        vpc: props.vpc,
        encrypted: true,
        performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
        throughputMode: efs.ThroughputMode.BURSTING,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        lifecyclePolicy: efs.LifecyclePolicy.AFTER_30_DAYS,
      });

      // Override the CDK denyAnonymousAccess feature flag policy:
      // Allow anonymous NFS mount (security enforced at SG level, not IAM).
      // Without this, the feature flag @aws-cdk/aws-efs:denyAnonymousAccess
      // blocks plain nfs4 mounts.
      fs.addToResourcePolicy(
        new iam.PolicyStatement({
          actions: [
            'elasticfilesystem:ClientMount',
            'elasticfilesystem:ClientWrite',
            'elasticfilesystem:ClientRootAccess',
          ],
          principals: [new iam.AnyPrincipal()],
          conditions: {
            Bool: { 'elasticfilesystem:AccessedViaMountTarget': 'true' },
          },
        }),
      );

      fs.connections.allowFrom(
        props.instanceSecurityGroup,
        ec2.Port.tcp(2049),
        'NFS from ClawForce EC2',
      );

      this.fileSystem = fs;
      this.fileSystemId = fs.fileSystemId;

      NagSuppressions.addResourceSuppressions(
        fs,
        [
          {
            id: 'AwsSolutions-EFS1',
            reason:
              'EFS in-transit encryption not required for intra-VPC NFS; encryption at rest is enabled',
          },
        ],
        true,
      );
    }
  }
}
