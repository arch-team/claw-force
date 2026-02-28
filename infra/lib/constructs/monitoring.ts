import { Construct } from 'constructs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as cdk from 'aws-cdk-lib/core';

export interface ClawForceMonitoringProps {
  /** Log retention in days (default: 30) */
  logRetentionDays?: number;
}

/**
 * CloudWatch monitoring construct for ClawForce.
 *
 * Two-phase usage:
 * 1. Construct creates log groups + generates agent config
 * 2. Call addAlarms(instance) after EC2 instance is created
 */
export class ClawForceMonitoring extends Construct {
  public readonly setupLogGroup: logs.LogGroup;
  public readonly appLogGroup: logs.LogGroup;
  public cpuAlarm?: cloudwatch.Alarm;
  public statusAlarm?: cloudwatch.Alarm;

  constructor(scope: Construct, id: string, props: ClawForceMonitoringProps = {}) {
    super(scope, id);

    const retentionDays = props.logRetentionDays ?? 30;
    const retention = this.mapRetention(retentionDays);

    // Log Groups
    this.setupLogGroup = new logs.LogGroup(this, 'SetupLogGroup', {
      logGroupName: '/clawforce/ec2/setup',
      retention,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.appLogGroup = new logs.LogGroup(this, 'AppLogGroup', {
      logGroupName: '/clawforce/openclaw/app',
      retention,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }

  /** Add CloudWatch alarms for the EC2 instance (call after instance creation) */
  public addAlarms(instance: ec2.Instance): void {
    this.cpuAlarm = new cloudwatch.Alarm(this, 'CpuAlarm', {
      alarmName: 'ClawForce-HighCPU',
      alarmDescription: 'ClawForce EC2 CPU utilization above 80 percent',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/EC2',
        metricName: 'CPUUtilization',
        dimensionsMap: { InstanceId: instance.instanceId },
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 80,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    });

    this.statusAlarm = new cloudwatch.Alarm(this, 'StatusAlarm', {
      alarmName: 'ClawForce-StatusCheck',
      alarmDescription: 'ClawForce EC2 instance or system status check failed',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/EC2',
        metricName: 'StatusCheckFailed',
        dimensionsMap: { InstanceId: instance.instanceId },
        period: cdk.Duration.minutes(1),
        statistic: 'Maximum',
      }),
      threshold: 1,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    });
  }

  /** Generate CloudWatch Agent config JSON for User Data injection */
  public getAgentConfig(): string {
    return JSON.stringify(
      {
        agent: { metrics_collection_interval: 60, run_as_user: 'root' },
        logs: {
          logs_collected: {
            files: {
              collect_list: [
                {
                  file_path: '/var/log/clawforce-setup.log',
                  log_group_name: this.setupLogGroup.logGroupName,
                  log_stream_name: '{instance_id}/setup',
                },
              ],
            },
          },
        },
        metrics: {
          namespace: 'ClawForce',
          metrics_collected: {
            disk: { measurement: ['used_percent'], resources: ['/'] },
            mem: { measurement: ['mem_used_percent'] },
          },
        },
      },
      null,
      2,
    );
  }

  private mapRetention(days: number): logs.RetentionDays {
    if (days <= 1) return logs.RetentionDays.ONE_DAY;
    if (days <= 7) return logs.RetentionDays.ONE_WEEK;
    if (days <= 14) return logs.RetentionDays.TWO_WEEKS;
    if (days <= 30) return logs.RetentionDays.ONE_MONTH;
    if (days <= 90) return logs.RetentionDays.THREE_MONTHS;
    return logs.RetentionDays.SIX_MONTHS;
  }
}
