import { Construct } from 'constructs';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';

export interface ClawForceWafProps {
  /** ALB ARN to associate the WebACL with */
  albArn: string;
}

/**
 * WAF WebACL construct for ClawForce ALB protection.
 *
 * Uses AWS Managed Rule Sets:
 * - AWSManagedRulesCommonRuleSet: Core OWASP protection
 * - AWSManagedRulesKnownBadInputsRuleSet: Known bad input patterns
 */
export class ClawForceWaf extends Construct {
  public readonly webAcl: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props: ClawForceWafProps) {
    super(scope, id);

    this.webAcl = new wafv2.CfnWebACL(this, 'WebACL', {
      name: 'ClawForce-WebACL',
      description: 'WAF protection for ClawForce ALB',
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: 'ClawForceWebACL',
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 1,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'CommonRuleSet',
            sampledRequestsEnabled: true,
          },
        },
        {
          name: 'AWSManagedRulesKnownBadInputsRuleSet',
          priority: 2,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesKnownBadInputsRuleSet',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'KnownBadInputsRuleSet',
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    // Associate WebACL with ALB
    new wafv2.CfnWebACLAssociation(this, 'WebACLAssociation', {
      webAclArn: this.webAcl.attrArn,
      resourceArn: props.albArn,
    });
  }
}
