import { get, merge } from 'lodash';
import { TerraformElement, TerraformLocal, TerraformOutput } from 'cdktf';

import { Stack } from '@stackmate/engine/core/stack';
import { Obj, ChoiceOf } from '@stackmate/engine/lib';
import { PROVIDER, SERVICE_TYPE } from '@stackmate/engine/constants';
import { ServiceSchema, mergeServiceSchemas } from '@stackmate/engine/core/schema';

/**
 * @type {ProviderChoice} a provider choice
 */
export type ProviderChoice = ChoiceOf<typeof PROVIDER>;

/**
 * @type {ServiceTypeChoice} a service type choice
 */
export type ServiceTypeChoice = ChoiceOf<typeof SERVICE_TYPE>;

/**
 * @type {ServiceScopeChoice} the provisioning scopes available
 */
export type ServiceScopeChoice = ChoiceOf<['deployable', 'preparable', 'destroyable']>;

/**
 * @type {Resource} a resource provisioned by the system
 */
export type Resource = TerraformElement;

/**
 * @type {ProvisionResources} types of resources that are provisioned by the handlers
 */
export type ProvisionResources = Resource | Resource[] | Record<string, Resource>;

/**
 * @type {Provisions} the type returned by provision handlers
 */
export type Provisions = Record<string, ProvisionResources> & {
  /**
   * The service's IP address to allow linking with services with
   */
  ip?: TerraformLocal;

  /**
   * The service's outputs
   */
  outputs?: TerraformOutput[];

  /**
   * A resource reference such as a resource's ID to link with services within the same provider
   */
  resourceRef?: TerraformLocal;
};

/**
 * @type {AssociationLookup} the function which determines whether an association takes effect
 */
export type AssociationLookup = (
  config: BaseServiceAttributes, linkedConfig: BaseServiceAttributes,
) => boolean;

/**
 * @type {AssociationHandler} the handler to run when an association takes effect
 */
export type AssociationHandler<
  Ret extends ProvisionResources,
  Attrs extends BaseServiceAttributes = BaseServiceAttributes
> = (
  linked: BaseProvisionable<Attrs>, target: BaseProvisionable<Attrs>, stack: Stack,
) => Ret;

/**
 * @type {Association} describes an association between two services
 */
export type Association<Ret extends ProvisionResources> = {
  handler: AssociationHandler<Ret>;
  from?: ServiceTypeChoice;
  where?: AssociationLookup;
  requirement?: boolean;
};

/**
 * @type {ServiceRequirement} the configuration object for associating a service with another
 * @param {ProvisionResources} Ret the handler's return type
 * @param {ServiceTypeChoice} S the service type choice the association refers to (optional)
 */
export type ServiceRequirement<
  Ret extends ProvisionResources,
  S extends ServiceTypeChoice = never,
> = Association<Ret> & { requirement: true; from?: S };

/**
 * @type {ServiceSideEffect} describes a generic association that is not a requirement
 */
export type ServiceSideEffect<
  Ret extends ProvisionResources = ProvisionResources
> = Association<Ret> & {
  where: AssociationLookup;
  requirement?: false;
};

/**
 * @type {ServiceAssociations} the service's associations
 */
export type ServiceAssociations = {
  [K in ServiceScopeChoice]?: Record<string, Association<any>>;
};

/**
 * @type {ExtractServiceRequirements} extracts service requirements from its associations
 */
type ExtractServiceRequirements<
  Associations extends ServiceAssociations,
  Scope extends ServiceScopeChoice,
> = {
  [K in keyof Associations[Scope]]: Associations[Scope][K] extends infer A extends Association<any>
    ? A['requirement'] extends true ? ReturnType<A['handler']> : never
    : never;
};

/**
 * @type {BaseProvisionable} base provisionable
 */
export type BaseProvisionable<Attrs extends BaseServiceAttributes = BaseServiceAttributes> = {
  id: string;
  service: BaseService;
  config: Attrs;
  provisions: Provisions;
  resourceId: string;
  sideEffects: Resource[];
  requirements: Record<string, ProvisionResources>;
};

/**
 * @type {Provisionable} represents a piece of configuration and service to be deployed
 */
export type Provisionable<
  Srv extends BaseService,
  Provs extends Provisions,
  Scope extends ServiceScopeChoice,
  Attrs extends BaseServiceAttributes = ExtractAttrs<Srv>
> = BaseProvisionable<Attrs> & {
  service: Srv;
  config: Attrs;
  provisions: Provs;
  requirements: ExtractServiceRequirements<Srv['associations'], Scope>;
};

/**
 * @type {ProvisionHandler} a function that can be used to deploy, prepare or destroy a service
 */
export type ProvisionHandler = (
  provisionable: BaseProvisionable,
  stack: Stack,
  opts?: object,
) => Provisions;

/**
 * @type {ServiceEnvironment} the environment variable required by a service
 */
export type ServiceEnvironment = {
  name: string;
  required: boolean;
  description?: string;
};

/**
 * @type {BaseServiceAttributes} Base attributes for any service in the system
 */
export type BaseServiceAttributes = {
  name: string;
  provider: ProviderChoice;
  type: ServiceTypeChoice;
  region?: string;
};

/**
 * @type {Service} accepts a set of service attributes and returns a Service object
 * @param {BaseServiceAttributes}
 * @param {Associations}
 */
export type Service<
  Setup extends BaseServiceAttributes,
  Associations extends ServiceAssociations = {}
> = {
  provider: ProviderChoice;
  type: ServiceTypeChoice;
  regions?: readonly string[];
  schemaId: string;
  schema: ServiceSchema<Setup>;
  environment: ServiceEnvironment[];
  handlers: Map<ServiceScopeChoice, ProvisionHandler>;
  associations: Associations;
};

/**
 * @type {BaseService} base service type
 */
export type BaseService = Service<BaseServiceAttributes>;

/**
 * @type {ExtractAttrs} extracts arguments from a service
 */
export type ExtractAttrs<T> = T extends Service<infer Attrs> ? Attrs : never;

/**
 * @type {WithAssociations} returns a service with additional associations
 */
export type WithAssociations<T extends BaseService, A extends ServiceAssociations> = T & {
  associations: A;
};

/**
 * Returns a base core service (one that cannot be part of a stage)
 *
 * @param provider {ProviderChoice} the provider for the core service
 * @param type {ServiceTypeChoice} the service type for the core service
 * @returns {Service<Obj>} the core service
 */
export const getCoreService = (
  provider: ProviderChoice, type: ServiceTypeChoice,
): Service<BaseServiceAttributes & { provider: typeof provider; type: typeof type }> => {
  const schemaId = `services/${provider}/${type}`;
  const schema: ServiceSchema<BaseServiceAttributes> = {
    $id: schemaId,
    type: 'object',
    required: [],
    additionalProperties: false,
    properties: {
      provider: {
        type: 'string',
        enum: [provider],
        default: provider,
        isIncludedInConfigGeneration: true,
        errorMessage: {
          enum: `The provider can only be set to "${provider}"`,
        },
      },
      type: {
        type: 'string',
        enum: [type],
        default: type,
        errorMessage: {
          enum: `You have to specify a valid service type, only ${type} is accepted`,
        },
      },
      region: {
        type: 'string',
        isIncludedInConfigGeneration: true,
      },
      name: {
        type: 'string',
        pattern: '^([a-zA-Z0-9_-]+)$',
        minLength: 2,
        description: 'The name for the service to deploy',
        errorMessage: {
          minLength: 'The service’s name should be two characters or more',
          pattern: 'The name property on the service should only contain characters, numbers, dashes and underscores',
        },
      },
    },
  };

  return {
    provider,
    type,
    schema,
    schemaId,
    environment: [],
    handlers: new Map(),
    associations: { 'deployable': {}, 'preparable': {}, 'destroyable': {} },
  };
};

/**
 * Returns a base cloud service (one that can be provisioned in stages)
 *
 * @param provider {ProviderChoice} the provider for the cloud service
 * @param type {ServiceTypeChoice} the service type for the cloud service
 * @returns {Service<Obj>} the cloud service
 */
export const getCloudService = (
  provider: ProviderChoice, type: ServiceTypeChoice,
): Service<BaseServiceAttributes & { provider: typeof provider; type: typeof type }> => {
  const core = getCoreService(provider, type);
  const schema: ServiceSchema<BaseServiceAttributes> = {
    ...core.schema,
    required: [...(core.schema.required || []), 'name', 'type'],
    properties: {
      ...core.schema.properties,
      type: {
        ...(core.schema.properties.type || {}),
        isIncludedInConfigGeneration: true,
      },
      name: {
        ...(core.schema.properties.name || {}),
        minLength: 3,
        isIncludedInConfigGeneration: true,
        serviceConfigGenerationTemplate: '${type}-service-${stageName}',
      },
    },
  };

  return {
    ...core,
    schema,
  };
};

/**
 * @var {ServiceTypeChoice[]} CORE_SERVICE_TYPES the core service types
 */
export const CORE_SERVICE_TYPES = [
  SERVICE_TYPE.STATE, SERVICE_TYPE.SECRETS, SERVICE_TYPE.PROVIDER,
] as ServiceTypeChoice[];

/**
 * @param {ServiceTypeChoice} type the type of service to check whether is a core service
 * @returns {Boolean} whether the given service type is a core service
 */
export const isCoreService = (type: ServiceTypeChoice): boolean => (
  CORE_SERVICE_TYPES.includes(type)
);

/**
 * @param {ProviderChoice} provider the provider to check
 * @returns {Boolean} whether the provider is a cloud provider
 */
export const isCloudProvider = (provider: ProviderChoice): boolean => (
  provider !== PROVIDER.LOCAL
);

/**
 * Updates a service given certain attributes
 *
 * @param {Partial<Service>} attrs the service attributes to apply
 * @returns {Function<Service>} the updated service
 */
export const withServiceProperties = <C extends BaseServiceAttributes, Attributes extends Obj = {}>(
  attrs: Attributes,
) => <T extends Service<C>>(srv: T): T & Attributes => ({
  ...srv,
  ...attrs,
});

/**
 * Adds schema modifications to a service (eg. when adding a new attribute)
 *
 * @param {JsonSchema} mods the schema modifications to apply
 * @returns {Function<Service>}
 */
export const withSchema = <C extends BaseServiceAttributes, Additions extends Obj = {}>(
  mods: ServiceSchema<Additions>,
) => <T extends Service<C>>(srv: T): T & { schema: ServiceSchema<Additions> } => ({
  ...srv,
  schema: mergeServiceSchemas(srv.schema, mods),
});

/**
 * Associates two services.
 * For example:
 *  const AwsRdsService = compose(
 *    ...
 *    associate({
 *      deployable: {
 *        associationName: {
 *          from: SERVICE_TYPE.PROVIDER,
 *          where: (cfg, providerCfg) => cfg.region === providerCfg.region && ....,
 *          handler: (p, stack) => p.provisions.find(p => p instanceof KmsKey),
 *        },
 *        // ...
 *      },
 *    }),
 *  )
 *
 * Which associate the current service (in our example AwsRdsService) with the "Provider" Service
 * for the `deployable` scope, under the alias `kmsKey`, when the criteria returned by `where`
 * match, using the `handler` function. The `handler` function returns the data to be used
 * as `requirements` when provisioning the service.
 *
 * @param {ServiceAssociations} associations the association configurations
 * @returns {Function<Service>}
 */
export const associate = <C extends BaseServiceAttributes, A extends ServiceAssociations>(
  associations: A
) => <T extends Service<C>>(service: T): WithAssociations<T, A> => ({
  ...service,
  associations: merge({}, service.associations, associations),
});

/**
 * Registers a handler to use when provisioning the service under a specific scope
 *
 * @param {ServiceScopeChoice} scope the scope to register the handler for
 * @param {ProvisionHandler} handler the handler that provisions the service
 * @returns {Function<Service>}
 */
export const withHandler = <C extends BaseServiceAttributes>(
  scope: ServiceScopeChoice, handler: ProvisionHandler,
) => <T extends Service<C>>(service: T): T => {
  if (service.handlers.has(scope)) {
    throw new Error(`There already is a handler for the “${scope}” scope for the “${service.type}” ${service.provider} service`);
  }

  return {
    ...service,
    handlers: new Map([...Array.from(service.handlers.entries()), [scope, handler]]),
  };
};

/**
 * Registers the environment variables to use when adding the service to the stack
 *
 * @param {String} name the environment variable's name
 * @param {String} description the environment variable's description
 * @param {Boolean} required whether the variable's presence is required
 * @returns {Function<Service>}
 */
export const withEnvironment = <C extends BaseServiceAttributes>(
  name: string, description: string, required: boolean = false,
) => <T extends Service<C>>(service: T): T => ({
  ...service,
  environment: [...service.environment, { name, required, description }],
});

/**
 * @param {BaseServiceAttributes} config the service's configuration
 * @param {String} stageName the stage's name
 * @returns {String} the id to use as a terraform resource identifier
 */
export const getProvisionableResourceId = (
  config: BaseServiceAttributes, stageName: string,
): string => (
  `${config.name || config.type}-${stageName}`
);

/**
 * @param {BaseProvisionable} provisionable the provisionable to check
 * @param {ServiceScopeChoice} scope the scope for the services
 * @throws {Error} if a requirement is not satisfied
 */
export const assertRequirementsSatisfied = (
  provisionable: BaseProvisionable, scope: ServiceScopeChoice,
) => {
  const { service: { associations: allAssociations, type }, requirements } = provisionable;
  const associations: ServiceAssociations[ServiceScopeChoice] = get(allAssociations, scope);

  if (!associations) {
    return;
  }

  Object.entries(associations).forEach(([name, assoc]) => {
    if (!assoc.requirement) {
      return;
    }

    if (!requirements[name]) {
      throw new Error(`Requirement ${name} for service ${type} is not satisfied`);
    }
  });
};
