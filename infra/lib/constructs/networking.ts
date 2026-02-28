import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export interface ClawForceNetworkingProps {
  /** VPC to place the security group in */
  vpc: ec2.IVpc;
  /** CIDR range allowed for SSH management access (e.g. "72.21.198.64/32") */
  allowedCidr: string;
}

/**
 * Security Group construct for ClawForce EC2 instance.
 *
 * Creates base SG with SSH access only. OpenClaw service ports (18789/18790/18791)
 * are managed by the stack based on ALB mode:
 * - ALB enabled: ports accept ALB security group traffic only
 * - ALB disabled: ports accept allowedCidr traffic directly (backward compatible)
 */
export class ClawForceNetworking extends Construct {
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: ClawForceNetworkingProps) {
    super(scope, id);

    this.securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc: props.vpc,
      // PoC lesson: ASCII-only descriptions for AWS API compatibility
      description: 'ClawForce OpenClaw instance security group',
      allowAllOutbound: true,
    });

    // SSH access - always from allowed CIDR (management port)
    this.securityGroup.addIngressRule(
      ec2.Peer.ipv4(props.allowedCidr),
      ec2.Port.tcp(22),
      'SSH access from allowed IP',
    );
  }
}
