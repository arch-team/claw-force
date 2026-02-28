import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export interface NetworkingProps {
  /** VPC to place the security group in */
  vpc: ec2.IVpc;
  /** CIDR range allowed for SSH and management access (e.g. "72.21.198.64/32") */
  allowedCidr: string;
}

/**
 * Security Group construct for ClawForce OpenClaw deployment.
 *
 * Ports based on PoC verification (poc-report.md):
 * - 22: SSH access
 * - 18789: OpenClaw Gateway (WebSocket)
 * - 18790: Control UI
 * - 18791: Browser Control Server
 */
export class ClawForceNetworking extends Construct {
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkingProps) {
    super(scope, id);

    this.securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc: props.vpc,
      // PoC lesson: ASCII-only descriptions for AWS API compatibility
      description: 'ClawForce OpenClaw instance security group',
      allowAllOutbound: true,
    });

    const peer = ec2.Peer.ipv4(props.allowedCidr);

    // SSH access
    this.securityGroup.addIngressRule(
      peer,
      ec2.Port.tcp(22),
      'SSH access from allowed IP',
    );

    // OpenClaw Gateway (WebSocket)
    this.securityGroup.addIngressRule(
      peer,
      ec2.Port.tcp(18789),
      'OpenClaw Gateway WebSocket',
    );

    // Control UI
    this.securityGroup.addIngressRule(
      peer,
      ec2.Port.tcp(18790),
      'OpenClaw Control UI',
    );

    // Browser Control Server
    this.securityGroup.addIngressRule(
      peer,
      ec2.Port.tcp(18791),
      'OpenClaw Browser Control Server',
    );
  }
}
