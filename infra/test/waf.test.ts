import * as cdk from 'aws-cdk-lib/core';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { ClawForceWaf } from '../lib/constructs/waf';

describe('ClawForceWaf', () => {
  let template: Template;

  beforeAll(() => {
    const stack = new cdk.Stack();
    new ClawForceWaf(stack, 'Waf', {
      albArn: 'arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/test-alb/1234567890',
    });
    template = Template.fromStack(stack);
  });

  test('creates WebACL with REGIONAL scope', () => {
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      Scope: 'REGIONAL',
      Name: 'ClawForce-WebACL',
    });
  });

  test('sets default action to allow', () => {
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      DefaultAction: { Allow: {} },
    });
  });

  test('enables CloudWatch metrics', () => {
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      VisibilityConfig: Match.objectLike({
        CloudWatchMetricsEnabled: true,
        MetricName: 'ClawForceWebACL',
        SampledRequestsEnabled: true,
      }),
    });
  });

  test('includes AWSManagedRulesCommonRuleSet', () => {
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      Rules: Match.arrayWith([
        Match.objectLike({
          Name: 'AWSManagedRulesCommonRuleSet',
          Priority: 1,
          OverrideAction: { None: {} },
          Statement: {
            ManagedRuleGroupStatement: {
              VendorName: 'AWS',
              Name: 'AWSManagedRulesCommonRuleSet',
            },
          },
        }),
      ]),
    });
  });

  test('includes AWSManagedRulesKnownBadInputsRuleSet', () => {
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      Rules: Match.arrayWith([
        Match.objectLike({
          Name: 'AWSManagedRulesKnownBadInputsRuleSet',
          Priority: 2,
          Statement: {
            ManagedRuleGroupStatement: {
              VendorName: 'AWS',
              Name: 'AWSManagedRulesKnownBadInputsRuleSet',
            },
          },
        }),
      ]),
    });
  });

  test('creates WebACL association with ALB', () => {
    template.resourceCountIs('AWS::WAFv2::WebACLAssociation', 1);
    template.hasResourceProperties('AWS::WAFv2::WebACLAssociation', {
      ResourceArn:
        'arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/test-alb/1234567890',
    });
  });

  test('has exactly two managed rule groups', () => {
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      Rules: Match.arrayWith([
        Match.objectLike({ Priority: 1 }),
        Match.objectLike({ Priority: 2 }),
      ]),
    });
  });
});
