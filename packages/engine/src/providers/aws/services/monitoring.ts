import pipe from '@bitty/pipe';
import { dataAwsIamPolicyDocument, snsTopic, snsTopicPolicy } from '@cdktf/provider-aws';

import { Stack } from '@stackmate/engine/core/stack';
import { SERVICE_TYPE } from '@stackmate/engine/constants';
import { DEFAULT_REGION, REGIONS } from '@stackmate/engine/providers/aws/constants';
import { MonitoringServiceAttributes } from '@stackmate/engine/providers/types';
import { databaseAlerts, DatabasebAlertResources } from '../alerts/rds';
import { AwsService, AwsServiceAttributes, getAwsCoreService } from '@stackmate/engine/providers/aws/service';
import { BaseProvisionable, Provisionable, withRegions, withSchema } from '@stackmate/engine/core/service';
import { associate, AssociationHandler, BaseServiceAttributes, ProvisionResources, ServiceSideEffect, ServiceTypeChoice } from '@stackmate/engine/core/service/core';
import { AlertingAttributes, getAlertingEmailsSchema, MonitoredProvisionable, MonitoredAttributes } from '@stackmate/engine/core/service/monitored';

/**
 * @type {AwsMonitoringAttributes} the AWS monitoring service (CloudWatch) attributes
 */
export type AwsMonitoringAttributes = AwsServiceAttributes<MonitoringServiceAttributes & {
  type: typeof SERVICE_TYPE.MONITORING;
}>;

/**
 * @type {AwsMonitoringAssociations} the AWS monitoring service associations
 */
export type AwsMonitoringAssociations = {
  deployable: {
    [SERVICE_TYPE.MARIADB]: ServiceSideEffect<DatabasebAlertResources>,
    [SERVICE_TYPE.MYSQL]: ServiceSideEffect<DatabasebAlertResources>,
    [SERVICE_TYPE.POSTGRESQL]: ServiceSideEffect<DatabasebAlertResources>,
  },
};

/**
 * @type {AwsMonitoringService} the AWS monitoring service
 */
export type AwsMonitoringService = AwsService<AwsMonitoringAttributes, AwsMonitoringAssociations>;

/**
 * @type {AwsMonitoringPrerequisites} the prerequisites for alert generators
 */
export type AwsMonitoringPrerequisites = {
  topic: snsTopic.SnsTopic;
  policy: snsTopicPolicy.SnsTopicPolicy;
  document: dataAwsIamPolicyDocument.DataAwsIamPolicyDocument;
};

/**
 * @type {AwsMonitoringDeployableProvisionable} the AWS monitoring service provisionable
 */
export type AwsMonitoringDeployableProvisionable = Provisionable<
  AwsMonitoringService, {}, 'deployable'
>;

/**
 * @var {Map} awsServiceIdentifiers the name & URL mapping to use when generating the policy
 */
const awsServiceIdentifiers: Map<ServiceTypeChoice, { name: string; url: string }> = new Map([
  [SERVICE_TYPE.MYSQL, { name: 'Allow RDS Events', url: 'rds.amazonaws.com' }],
  [SERVICE_TYPE.MARIADB, { name: 'Allow RDS Events', url: 'rds.amazonaws.com' }],
  [SERVICE_TYPE.POSTGRESQL, { name: 'Allow RDS Events', url: 'rds.amazonaws.com' }],
]);

/**
 * @param {AwsMonitoringDeployableProvisionable} monitoring the current service's provisionable
 * @param {Stack} stack the stack to provision resources on
 * @param {BaseProvisionable} target the target provisionable
 * @returns {AwsMonitoringPrerequisites} the prerequisites for alert generator functions
 */
const getMonitoringPrerequisites = (
  monitoring: AwsMonitoringDeployableProvisionable, stack: Stack, target: BaseProvisionable,
): AwsMonitoringPrerequisites => {
  const { config: { type, region }, requirements: { providerInstance, account } } = monitoring;
  const { service: { type: targetType } } = target;
  const topicId = `monitoring-${type}-${region || 'global'}-${stack.stageName}`;

  const topic = new snsTopic.SnsTopic(stack.context, topicId, {
    name: topicId,
    provider: providerInstance,
  });

  const serviceStatements = [{
    sid: 'Allow CloudWatch Events',
    actions: ['sns:Publish'],
    resources: [topic.arn],
    principals: [{ type: 'Service', identifiers: ['events.amazonaws.com'] }],
  }];

  const serviceIdentifier = awsServiceIdentifiers.get(targetType);
  if (serviceIdentifier) {
    serviceStatements.push({
      sid: serviceIdentifier.name,
      actions: ['sns:Publish'],
      resources: [topic.arn],
      principals: [{ type: 'Service', identifiers: [serviceIdentifier.url] }],
    });
  }

  const document = new dataAwsIamPolicyDocument.DataAwsIamPolicyDocument(
    stack.context, `sns-${topicId}-policy-document`, {
    dependsOn: [topic],
    statement: [{
      // Allow the account owner to manage SNS
      sid: 'AllowManageSNS',
      actions: [
        'SNS:Subscribe',
        'SNS:SetTopicAttributes',
        'SNS:RemovePermission',
        'SNS:Receive',
        'SNS:Publish',
        'SNS:ListSubscriptionsByTopic',
        'SNS:GetTopicAttributes',
        'SNS:DeleteTopic',
        'SNS:AddPermission',
      ],
      effect: 'Allow',
      resources: [topic.arn],
      principals: [{
        type: 'AWS',
        identifiers: ['*'],
      }],
      condition: [{
        test: 'StringEquals',
        variable: 'AWS:SourceOwner',
        values: [account.accountId],
      }],
    }],
  },
  );

  const policy = new snsTopicPolicy.SnsTopicPolicy(stack.context, `${topicId}-policy`, {
    arn: topic.arn,
    policy: document.json,
    dependsOn: [document],
  });

  return { topic, policy, document };
};

/**
 * @param {AwsMonitoringAttributes} cfg the monitoring service's attributes
 * @param {BaseServiceAttributes} linked the linkable service's attributes
 * @returns {Boolean} whether the two services are associated
 */
const isAssociatedWith = (
  cfg: AwsMonitoringAttributes, linked: BaseServiceAttributes & MonitoredAttributes,
): boolean => (
  linked.monitoring && cfg.provider === linked.provider && cfg.region === linked.region
);

/**
 * @param {Function<ProvisionResources>} alertGenerator the service's alert generator function
 * @returns {Function<ProvisionResources>} the handler to use in associations
 */
const getAssociationHandler = (
  alertGenerator: AssociationHandler<ProvisionResources>
): AssociationHandler<ProvisionResources> => (
  source: MonitoredProvisionable, stack: Stack, monitoring: AwsMonitoringDeployableProvisionable,
): AwsMonitoringPrerequisites | ProvisionResources => {
  const prerequisites = getMonitoringPrerequisites(monitoring, stack, source);
  const alerts = alertGenerator(monitoring, stack, source, prerequisites);

  return {
    ...prerequisites,
    ...alerts,
  };
};

/**
 * @param {ServiceTypeChoice} type the service type to associate with
 * @param {Function<ProvisionResources>} alertsGenerator the alert generator function
 * @returns {Association} the association to use with the service
 */
const getAssociation = (
  type: ServiceTypeChoice, alertsGenerator: AssociationHandler<ProvisionResources>,
): ServiceSideEffect => ({
  with: type,
  where: isAssociatedWith,
  sideEffect: true,
  handler: getAssociationHandler(alertsGenerator),
});

/**
 * @var {Associations} associations the service's associations
 */
const associations: AwsMonitoringAssociations = {
  deployable: {
    [SERVICE_TYPE.MARIADB]: getAssociation(SERVICE_TYPE.MARIADB, databaseAlerts),
    [SERVICE_TYPE.MYSQL]: getAssociation(SERVICE_TYPE.MYSQL, databaseAlerts),
    [SERVICE_TYPE.POSTGRESQL]: getAssociation(SERVICE_TYPE.POSTGRESQL, databaseAlerts),
  },
};

/**
 * @returns {AwsMonitoringService} the AWS monitoring service
 */
export const getMonitoringService = (): AwsMonitoringService => (
  pipe(
    associate(associations),
    withRegions(REGIONS, DEFAULT_REGION),
    withSchema<AwsMonitoringAttributes, AlertingAttributes>({
      type: 'object',
      properties: {
        emails: getAlertingEmailsSchema(),
      },
    }),
  )(getAwsCoreService(SERVICE_TYPE.MONITORING))
);

export const AwsMonitoring = getMonitoringService();