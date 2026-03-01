import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as targets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cdk from 'aws-cdk-lib/core';
import { NagSuppressions } from 'cdk-nag';
import { OPENCLAW_PORTS } from '../config/constants';

export interface ClawForceAlbProps {
  /** VPC for the ALB */
  readonly vpc: ec2.IVpc;
  /** EC2 instance to forward traffic to */
  readonly instance: ec2.Instance;
  /** ACM certificate ARN for HTTPS (optional - HTTP only if omitted) */
  readonly certificateArn?: string;
}

/**
 * Application Load Balancer construct for ClawForce.
 *
 * Provides a single ALB entry point for OpenClaw services:
 * - /          -> Control UI (served on Gateway port 18789)
 * - /ws        -> Gateway WebSocket (port 18789)
 *
 * Note: Browser service (18791) binds to 127.0.0.1 and is not ALB-routable.
 * When certificateArn is provided, enables HTTPS with HTTP->HTTPS redirect.
 */
export class ClawForceAlb extends Construct {
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly albSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: ClawForceAlbProps) {
    super(scope, id);

    // ALB Security Group - open to internet on 80/443
    this.albSecurityGroup = new ec2.SecurityGroup(this, 'AlbSecurityGroup', {
      vpc: props.vpc,
      description: 'ClawForce ALB security group - internet facing',
      allowAllOutbound: true,
    });

    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'HTTP from internet',
    );

    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'HTTPS from internet',
    );

    // Application Load Balancer
    this.alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: this.albSecurityGroup,
      loadBalancerName: 'ClawForce-ALB',
    });

    // Single Target Group — OpenClaw serves Gateway + Control UI on the same port
    const gatewayTarget = new elbv2.ApplicationTargetGroup(this, 'GatewayTG', {
      vpc: props.vpc,
      port: OPENCLAW_PORTS.GATEWAY,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [new targets.InstanceTarget(props.instance, OPENCLAW_PORTS.GATEWAY)],
      healthCheck: {
        path: '/',
        port: String(OPENCLAW_PORTS.GATEWAY),
        healthyHttpCodes: '200-399,426',
      },
      targetGroupName: 'ClawForce-Gateway',
      stickinessCookieDuration: cdk.Duration.days(1),
    });

    if (props.certificateArn) {
      // HTTPS mode: 443 listener + HTTP->HTTPS redirect
      const certificate = acm.Certificate.fromCertificateArn(
        this,
        'Certificate',
        props.certificateArn,
      );

      this.alb.addListener('HttpsListener', {
        port: 443,
        protocol: elbv2.ApplicationProtocol.HTTPS,
        certificates: [certificate],
        defaultTargetGroups: [gatewayTarget],
      });

      // HTTP -> HTTPS redirect
      this.alb.addListener('HttpRedirect', {
        port: 80,
        protocol: elbv2.ApplicationProtocol.HTTP,
        defaultAction: elbv2.ListenerAction.redirect({
          protocol: 'HTTPS',
          port: '443',
          permanent: true,
        }),
      });
    } else {
      // HTTP-only mode: all traffic to Gateway (serves Control UI + WebSocket)
      this.alb.addListener('HttpListener', {
        port: 80,
        protocol: elbv2.ApplicationProtocol.HTTP,
        defaultTargetGroups: [gatewayTarget],
      });
    }

    // CDK Nag suppressions (resource-level)
    NagSuppressions.addResourceSuppressions(
      this.alb,
      [
        {
          id: 'AwsSolutions-ELB2',
          reason:
            'ALB access logs require an S3 bucket; deferred to cost-optimization phase to avoid unnecessary S3 costs',
        },
      ],
      true,
    );
    NagSuppressions.addResourceSuppressions(
      this.albSecurityGroup,
      [
        {
          id: 'AwsSolutions-EC23',
          reason:
            'ALB security group intentionally allows 0.0.0.0/0 on ports 80/443 as it is an internet-facing load balancer',
        },
      ],
      true,
    );
  }
}
