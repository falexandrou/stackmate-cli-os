import pipe from 'lodash/fp/pipe';
import { get, isEmpty, uniqBy } from 'lodash';

import { Registry } from '@core/registry';
import { hashObject } from '@lib/hash';
import { getStack, Stack } from '@core/stack';
import { DEFAULT_PROJECT_NAME } from '@constants';
import { validate, validateEnvironment, validateServices } from '@core/validation';
import { getServiceConfigurations, Project, withLocalState } from '@core/project';
import {
  assertRequirementsSatisfied, BaseServiceAttributes, BaseProvisionable, Provisions,
  ServiceEnvironment, ServiceScopeChoice, ServiceAssociations, AnyAssociationHandler,
} from '@core/service';

type ProvisionablesMap = Map<BaseProvisionable['id'], BaseProvisionable>;

type AssociatedProvisionable = {
  name: string;
  target: BaseProvisionable;
  handler: AnyAssociationHandler;
};

type AssociatedProvisionablesMapping = Map<BaseProvisionable['id'], AssociatedProvisionable[]>;

export type OperationType = 'deployment' | 'destruction' | 'setup';

export const OPERATION_TYPE: Record<string, OperationType> = {
  DEPLOYMENT: 'deployment',
  DESTRUCTION: 'destruction',
  SETUP: 'setup',
} as const;

/**
 * @type {Operation} an operation that synthesizes the terraform files
 */
export type Operation = {
  readonly stack: Stack;
  readonly scope: ServiceScopeChoice;
  readonly provisionables: ProvisionablesMap;
  environment(): ServiceEnvironment[];
  process(): object;
};

/**
 * @param {BaseServiceAttributes} config the service's configuration
 * @param {String} stageName the stage's name
 * @returns {String} the id to use as a terraform resource identifier
 */
const getProvisionableResourceId = (config: BaseServiceAttributes): string => (
  `${config.name || config.type}-${config.provider}-${config.region || 'default'}`
);

/**
 * @param {BaseServiceAttributes} config the service's configuration
 * @returns {BaseProvisionable} the provisionable to use in operations
 */
export const getProvisionable = (config: BaseServiceAttributes): BaseProvisionable => {
  const service = Registry.fromConfig(config);

  return {
    id: hashObject(config),
    config,
    service,
    requirements: {},
    provisions: {},
    sideEffects: {},
    registered: false,
    resourceId: getProvisionableResourceId(config),
  };
};

class StageOperation implements Operation {
  /**
   * @var {Stack} stack the stack to deploy
   * @readonly
   */
  readonly stack: Stack;

  /**
   * @var {ServiceScopeChoice} scope the services scope
   * @readonly
   */
  readonly scope: ServiceScopeChoice;

  /**
   * @var {ProvisionablesMap} provisionables the list of provisionable services
   */
  readonly provisionables: ProvisionablesMap = new Map();

  /**
   * @var {ServiceEnvironment[]} #environment the environment variables required for the operation
   * @private
   */
  #environment: ServiceEnvironment[];

  /**
   * @var {AssociationHandlersMapping} requirements the provisionable id per requirement mapping
   */
  #requirements: AssociatedProvisionablesMapping = new Map();

  /**
   * @var {AssociationHandlersMapping} sideEffects the provisionable id per side-effects mapping
   */
  #sideEffects: AssociatedProvisionablesMapping = new Map();

  /**
   * @constructor
   * @param {BaseServiceAttributes[]} services the services to provision
   * @param {Stack} stack the stage's stack
   * @param {ServiceScopeChoice} scope the services provisionable scope
   */
  constructor(
    services: BaseServiceAttributes[], stack: Stack, scope: ServiceScopeChoice = 'deployable',
  ) {
    this.stack = stack;
    this.scope = scope;
    this.setupProvisionables(services);
  }

  /**
   * Processes an operation and returns the Terraform configuration as an object
   *
   * @returns {Object} the terraform configuration object
   */
  process(): object {
    validateEnvironment(this.environment());
    this.provisionables.forEach(provisionable => this.register(provisionable));
    return this.stack.toObject();
  }

  /**
   * Returns the environment variables required by the services
   *
   * @returns {ServiceEnvironment[]} the environment variables
   */
  environment(): ServiceEnvironment[] {
    if (!this.#environment) {
      const envVariables = Array.from(this.provisionables.values()).map(
        p => p.service.environment,
      ).filter(
        e => !isEmpty(e),
      ).flat();

      this.#environment = uniqBy(envVariables, e => e.name);
    }

    return this.#environment;
  }

  /**
   * @param {BaseServiceAttributes[]} services the services to set up as provisionables
   */
  protected setupProvisionables(services: BaseServiceAttributes[]) {
    services.forEach((config) => {
      const provisionable = getProvisionable(config);
      this.provisionables.set(provisionable.id, provisionable);
    });

    for (const provisionable of this.provisionables.values()) {
      const { config, service: { associations: assocs } } = provisionable;
      const scopeAssociations: ServiceAssociations[ServiceScopeChoice] = get(
        assocs, this.scope, {},
      );

      for (const [associationName, association] of Object.entries(scopeAssociations || {})) {
        const {
          where: isAssociated,
          handler: associationHandler,
          with: associatedServiceType,
          requirement: isRequirement,
        } = association;

        for (const linked of this.provisionables.values()) {
          if (associatedServiceType && linked.service.type !== associatedServiceType) {
            continue;
          }

          if (typeof isAssociated === 'function' && !isAssociated(config, linked.config)) {
            continue;
          }

          const targetMap = isRequirement ? this.#requirements : this.#sideEffects;
          const links = targetMap.get(provisionable.id) || [];

          targetMap.set(provisionable.id, [
            ...links,
            { target: linked, name: associationName, handler: associationHandler },
          ]);
        }
      }
    }
  }

  /**
   * Registers a provisionable and its associations to the stack
   *
   * @param {BaseProvisionable} provisionable the provisionable to register
   */
  protected register(provisionable: BaseProvisionable): Provisions {
    // Item has already been provisioned, bail...
    if (provisionable.registered) {
      return provisionable.provisions;
    }

    const { config, service, service: { handlers } } = provisionable;

    // Validate the configuration
    validate(service.schemaId, config, { useDefaults: true });

    // Provision & verify the requirements first
    Object.assign(provisionable, {
      requirements: this.registerAssociated(provisionable, this.#requirements.get(provisionable.id)),
    });

    assertRequirementsSatisfied(provisionable, this.scope);

    // there is a chance we don't have any handler for the current scope,
    // for example it only has a handler for deployment, we're running a 'setup' operation
    const registrationHandler = handlers.get(this.scope);

    Object.assign(provisionable, {
      provisions: registrationHandler ? registrationHandler(provisionable, this.stack) : {},
      registered: true,
    });

    // Now that the provisionable is registered into the stack, take care of the side-effetcs
    Object.assign(provisionable, {
      sideEffects: this.registerAssociated(provisionable, this.#sideEffects.get(provisionable.id)),
    });

    this.provisionables.set(provisionable.id, provisionable);
    return provisionable.provisions;
  }

  /**
   * @param {BaseProvisionable} provisionable the source provisionable
   * @param {AssociatedProvisionable[]} links the linked provisionables
   * @returns {Object} the output
  */
  protected registerAssociated(
    provisionable: BaseProvisionable, links?: AssociatedProvisionable[],
  ): Object {
    if (!links) {
      return {};
    }

    const output = {};

    links.forEach((link) => {
      const { target, name, handler } = link;
      const linkedProvisions = this.register(target);
      const out = handler({ ...target, provisions: linkedProvisions }, this.stack, provisionable);

      if (output) {
        Object.assign(output, { [name]: out });
      }
    });

    return output;
  }
};

/**
 * Returns an operation for a project, stage and services
 *
 * @param {String} projectName the project's name
 * @param {String} stageName the stage's name
 * @param {ServiceScopeChoice} scope the operation's scope
 * @returns
 */
const getOperation = (
  projectName: string, stageName: string, scope: ServiceScopeChoice,
) => (services: BaseServiceAttributes[]): Operation => {
  const stack = getStack(projectName, stageName);
  return new StageOperation(services, stack, scope);
};

/**
 * Returns a deployment operation
 *
 * @param {Project} project the project's configuration
 * @param {String} stage the stage's name
 * @returns {Operation} the deployment operation
 */
export const deployment = (project: Project, stage: string) => (
  pipe(
    getServiceConfigurations(stage),
    validateServices(),
    getOperation(project.name || DEFAULT_PROJECT_NAME, stage, 'deployable'),
  )(project)
);

/**
 * Returns a destruction operation
 *
 * @param {Project} project the project's configuration
 * @param {String} stage the stage's name
 * @returns {Operation} the destruction operation
 */
export const destruction = (project: Project, stage: string) => (
  pipe(
    getServiceConfigurations(stage),
    validateServices(),
    getOperation(project.name || DEFAULT_PROJECT_NAME, stage, 'destroyable'),
  )(project)
);

/**
 * Returns a setup operation (which uses a local state service)
 *
 * @param {Project} project the project's configuration
 * @param {String} stage the stage's name
 * @returns {Operation} the destruction operation
 */
export const setup = (project: Project, stage: string) => (
  pipe(
    getServiceConfigurations(stage),
    validateServices(),
    withLocalState(),
    getOperation(project.name || DEFAULT_PROJECT_NAME, stage, 'preparable'),
  )(project)
);

/**
 * Returns an operation by its name
 *
 * @param {OperationType} operation the operation to get
 * @param {Project} project the validated project configuration
 * @param {String} stage the stage name
 * @returns {Operation} the operation to use
 */
export const getOperationByName = (
  operation: OperationType, project: Project, stage: string,
): Operation => {
  switch (operation) {
    case OPERATION_TYPE.DEPLOYMENT:
      return deployment(project, stage);

    case OPERATION_TYPE.DESTRUCTION:
      return destruction(project, stage);

    case OPERATION_TYPE.SETUP:
      return setup(project, stage);

    default:
      throw new Error(`Operation ${operation} is invalid`);
  }
};
