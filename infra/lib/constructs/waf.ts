import { Construct } from 'constructs';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';

export interface ClawForceWafProps {
  /** ALB ARN to associate the WebACL with */
  readonly albArn: string;
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
        managedRuleGroup('AWSManagedRulesCommonRuleSet', 1, 'CommonRuleSet'),
        managedRuleGroup('AWSManagedRulesKnownBadInputsRuleSet', 2, 'KnownBadInputsRuleSet'),
      ],
    });

    // Associate WebACL with ALB
    new wafv2.CfnWebACLAssociation(this, 'WebACLAssociation', {
      webAclArn: this.webAcl.attrArn,
      resourceArn: props.albArn,
    });
  }
}

/** Build an AWS Managed Rule Group entry for the WebACL rules array. */
function managedRuleGroup(
  name: string,
  priority: number,
  metricName: string,
): wafv2.CfnWebACL.RuleProperty {
  return {
    name,
    priority,
    overrideAction: { none: {} },
    statement: {
      managedRuleGroupStatement: {
        vendorName: 'AWS',
        name,
      },
    },
    visibilityConfig: {
      cloudWatchMetricsEnabled: true,
      metricName,
      sampledRequestsEnabled: true,
    },
  };
}
