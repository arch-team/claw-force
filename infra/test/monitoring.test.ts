import * as cdk from 'aws-cdk-lib/core';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Template } from 'aws-cdk-lib/assertions';
import { ClawForceMonitoring } from '../lib/constructs/monitoring';

describe('ClawForceMonitoring', () => {
  describe('phase 1 - log groups (before compute)', () => {
    let template: Template;

    beforeAll(() => {
      const stack = new cdk.Stack();
      new ClawForceMonitoring(stack, 'Monitoring');
      template = Template.fromStack(stack);
    });

    test('creates setup log group', () => {
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: '/clawforce/ec2/setup',
      });
    });

    test('creates app log group', () => {
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: '/clawforce/openclaw/app',
      });
    });

    test('sets 30-day default retention', () => {
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        RetentionInDays: 30,
      });
    });

    test('sets DESTROY removal policy', () => {
      template.hasResource('AWS::Logs::LogGroup', {
        UpdateReplacePolicy: 'Delete',
        DeletionPolicy: 'Delete',
      });
    });

    test('does not create alarms without addAlarms call', () => {
      template.resourceCountIs('AWS::CloudWatch::Alarm', 0);
    });
  });

  describe('phase 2 - alarms (after compute)', () => {
    let template: Template;

    beforeAll(() => {
      const stack = new cdk.Stack();
      const monitoring = new ClawForceMonitoring(stack, 'Monitoring');

      const vpc = new ec2.Vpc(stack, 'Vpc', { maxAzs: 2 });
      const instance = new ec2.Instance(stack, 'Instance', {
        vpc,
        instanceType: new ec2.InstanceType('t3.micro'),
        machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      });

      monitoring.addAlarms(instance);
      template = Template.fromStack(stack);
    });

    test('creates CPU utilization alarm', () => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'ClawForce-HighCPU',
        Threshold: 80,
        EvaluationPeriods: 3,
        ComparisonOperator: 'GreaterThanThreshold',
        TreatMissingData: 'breaching',
      });
    });

    test('creates status check alarm', () => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'ClawForce-StatusCheck',
        Threshold: 1,
        EvaluationPeriods: 2,
        ComparisonOperator: 'GreaterThanOrEqualToThreshold',
        TreatMissingData: 'breaching',
      });
    });

    test('creates exactly 2 alarms', () => {
      template.resourceCountIs('AWS::CloudWatch::Alarm', 2);
    });
  });

  describe('agent config generation', () => {
    test('returns valid JSON with required sections', () => {
      const stack = new cdk.Stack();
      const monitoring = new ClawForceMonitoring(stack, 'Monitoring');
      const config = JSON.parse(monitoring.getAgentConfig());

      expect(config).toHaveProperty('agent');
      expect(config).toHaveProperty('logs');
      expect(config).toHaveProperty('metrics');
    });

    test('configures setup log collection', () => {
      const stack = new cdk.Stack();
      const monitoring = new ClawForceMonitoring(stack, 'Monitoring');
      const config = JSON.parse(monitoring.getAgentConfig());

      const collectList = config.logs.logs_collected.files.collect_list;
      expect(collectList).toHaveLength(1);
      expect(collectList[0].file_path).toBe('/var/log/clawforce-setup.log');
      // log_group_name is a CDK Token reference, verify it exists
      expect(collectList[0]).toHaveProperty('log_group_name');
    });

    test('configures disk and memory metrics', () => {
      const stack = new cdk.Stack();
      const monitoring = new ClawForceMonitoring(stack, 'Monitoring');
      const config = JSON.parse(monitoring.getAgentConfig());

      expect(config.metrics.namespace).toBe('ClawForce');
      expect(config.metrics.metrics_collected).toHaveProperty('disk');
      expect(config.metrics.metrics_collected).toHaveProperty('mem');
    });
  });

  describe('custom retention', () => {
    test('maps 7 days to ONE_WEEK', () => {
      const stack = new cdk.Stack();
      new ClawForceMonitoring(stack, 'Monitoring', {
        logRetentionDays: 7,
      });
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        RetentionInDays: 7,
      });
    });

    test('maps 90 days to THREE_MONTHS', () => {
      const stack = new cdk.Stack();
      new ClawForceMonitoring(stack, 'Monitoring', {
        logRetentionDays: 90,
      });
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        RetentionInDays: 90,
      });
    });
  });
});
