import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as targets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cdk from 'aws-cdk-lib/core';

export interface ClawForceAlbProps {
  /** VPC for the ALB */
  vpc: ec2.IVpc;
  /** EC2 instance to forward traffic to */
  instance: ec2.Instance;
  /** ACM certificate ARN for HTTPS (optional - HTTP only if omitted) */
  certificateArn?: string;
}

/**
 * Application Load Balancer construct for ClawForce.
 *
 * Provides a single ALB entry point for all OpenClaw services:
 * - /          -> Control UI (port 18790)
 * - /ws        -> Gateway WebSocket (port 18789)
 * - /browser   -> Browser Control (port 18791)
 *
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

    // Target Groups for each OpenClaw service
    const controlUiTarget = new elbv2.ApplicationTargetGroup(this, 'ControlUiTG', {
      vpc: props.vpc,
      port: 18790,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [new targets.InstanceTarget(props.instance, 18790)],
      healthCheck: {
        path: '/',
        port: '18790',
        healthyHttpCodes: '200-399',
      },
      targetGroupName: 'ClawForce-ControlUI',
    });

    const gatewayTarget = new elbv2.ApplicationTargetGroup(this, 'GatewayTG', {
      vpc: props.vpc,
      port: 18789,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [new targets.InstanceTarget(props.instance, 18789)],
      healthCheck: {
        path: '/',
        port: '18789',
        healthyHttpCodes: '200-399,426',
      },
      targetGroupName: 'ClawForce-Gateway',
      stickinessCookieDuration: cdk.Duration.days(1),
    });

    const browserTarget = new elbv2.ApplicationTargetGroup(this, 'BrowserTG', {
      vpc: props.vpc,
      port: 18791,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [new targets.InstanceTarget(props.instance, 18791)],
      healthCheck: {
        path: '/',
        port: '18791',
        healthyHttpCodes: '200-399',
      },
      targetGroupName: 'ClawForce-Browser',
    });

    if (props.certificateArn) {
      // HTTPS mode: 443 listener + HTTP->HTTPS redirect
      const certificate = acm.Certificate.fromCertificateArn(
        this,
        'Certificate',
        props.certificateArn,
      );

      const httpsListener = this.alb.addListener('HttpsListener', {
        port: 443,
        protocol: elbv2.ApplicationProtocol.HTTPS,
        certificates: [certificate],
        defaultTargetGroups: [controlUiTarget],
      });

      // Path-based routing for WebSocket and Browser
      httpsListener.addTargetGroups('GatewayRule', {
        priority: 10,
        conditions: [elbv2.ListenerCondition.pathPatterns(['/ws', '/ws/*'])],
        targetGroups: [gatewayTarget],
      });

      httpsListener.addTargetGroups('BrowserRule', {
        priority: 20,
        conditions: [elbv2.ListenerCondition.pathPatterns(['/browser', '/browser/*'])],
        targetGroups: [browserTarget],
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
      // HTTP-only mode: direct routing on port 80
      const httpListener = this.alb.addListener('HttpListener', {
        port: 80,
        protocol: elbv2.ApplicationProtocol.HTTP,
        defaultTargetGroups: [controlUiTarget],
      });

      httpListener.addTargetGroups('GatewayRule', {
        priority: 10,
        conditions: [elbv2.ListenerCondition.pathPatterns(['/ws', '/ws/*'])],
        targetGroups: [gatewayTarget],
      });

      httpListener.addTargetGroups('BrowserRule', {
        priority: 20,
        conditions: [elbv2.ListenerCondition.pathPatterns(['/browser', '/browser/*'])],
        targetGroups: [browserTarget],
      });
    }
  }
}
