import { pipe } from 'lodash/fp';
import { Construct } from 'constructs';

import { Stack } from '@stackmate/engine/core/stack';
import { OneOfType, Obj, MinMax, ChoiceOf, OneOf } from '@stackmate/engine/types';
import { CLOUD_PROVIDER, DEFAULT_SERVICE_STORAGE, PROVIDER, SERVICE_TYPE } from '@stackmate/engine/constants';
import { ServiceSchema, mergeServiceSchemas } from '@stackmate/engine/core/schema';

export type ProviderChoice = ChoiceOf<typeof PROVIDER>;
export type CloudProviderChoice = ChoiceOf<typeof CLOUD_PROVIDER>;
export type ServiceTypeChoice = ChoiceOf<typeof SERVICE_TYPE>;
export type ServiceScopeChoice = OneOf<['deployable', 'preparable', 'destroyable']>;

export type ProvisionHandler = (
  config: object, stack: Stack, requirements: Record<string, Construct>,
) => Record<string, Construct>;

export type ServiceAssociation = {
  from: ServiceTypeChoice,
  scope: ServiceScopeChoice,
  as: string,
  where: (config: object, linkedConfig: object) => boolean,
  handler: (config: object, stack: Stack) => OneOfType<[Construct, Construct[], Record<string, Construct>]>;
};

export type ServiceEnvironment = {
  name: string;
  required: boolean;
  description?: string;
};

/**
 * @type {CoreServiceAttributes} Attributes for core services, such as state, provider and secrets
 */
export type CoreServiceAttributes = {
  provider: ProviderChoice;
  type: ServiceTypeChoice;
  region?: string;
};

/**
 * @type {CloudServiceAttributes} Attributes for cloud services, which can be part of stages
 */
export type CloudServiceAttributes = CoreServiceAttributes & {
  name: string;
  links: string[];
  overrides: object;
};

/**
 * @type {BaseServiceAttributes} a union of the base service attribute sets
 */
export type BaseServiceAttributes = CoreServiceAttributes | CloudServiceAttributes;

/**
 * @type {Service} accepts a set of service attributes and returns a Service object
 */
export type Service<Setup extends BaseServiceAttributes> = {
  provider: ProviderChoice;
  type: ServiceTypeChoice;
  regions?: readonly string[];
  schemaId: string;
  schema: ServiceSchema<Setup>;
  handlers: Map<ServiceScopeChoice, ProvisionHandler>;
  environment: ServiceEnvironment[];
  associations: ServiceAssociation[];
};

export type CoreService = Service<CoreServiceAttributes>;
export type CloudService = Service<CloudServiceAttributes>;
export type BaseService = CoreService | CloudService;
export type ServiceCollection = Record<ProviderChoice, BaseService>;

/**
 * Returns a base core service (one that cannot be part of a stage)
 *
 * @param provider {ProviderChoice} the provider for the core service
 * @param type {ServiceTypeChoice} the service type for the core service
 * @returns {Service<Obj>} the core service
 */
export const getCoreService = (provider: ProviderChoice, type: ServiceTypeChoice): CoreService => {
  const schemaId = `/services/${provider}/${type}`;
  const schema: ServiceSchema<CoreServiceAttributes> = {
    $id: schemaId,
    type: 'object',
    required: [],
    additionalProperties: false,
    properties: {
      provider: {
        type: 'string',
        enum: [provider],
        default: provider,
        errorMessage: `The provider can only be set to "${provider}"`,
      },
      type: {
        type: 'string',
        enum: [type],
        default: type,
        errorMessage: `You have to specify a valid service type, "${type}" is invalid`,
      },
    },
    errorMessage: {
      _: 'The service configuration is invalid',
    },
  };

  return {
    provider,
    type,
    schema,
    schemaId,
    handlers: new Map(),
    environment: [],
    associations: [],
  };
};

/**
 * Returns a base cloud service (one that can be provisioned in stages)
 *
 * @param provider {ProviderChoice} the provider for the cloud service
 * @param type {ServiceTypeChoice} the service type for the cloud service
 * @returns {Service<Obj>} the cloud service
 */
export const getCloudService = (provider: ProviderChoice, type: ServiceTypeChoice): CloudService => {
  const core = getCoreService(provider, type);
  const schema: ServiceSchema<CloudServiceAttributes> = {
    ...core.schema,
    required: [...(core.schema.required || []), 'name', 'type'],
    properties: {
      ...core.schema.properties,
      name: {
        type: 'string',
        pattern: '[a-zA-Z0-9_]+',
        description: 'The name for the service to deploy',
        errorMessage: 'The name for the service should only contain characters, numbers and underscores',
      },
      links: {
        type: 'array',
        default: [],
        serviceLinks: true,
        items: { type: 'string' },
      },
      overrides: {
        type: 'object',
        default: {},
        serviceProfileOverrides: true,
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
  SERVICE_TYPE.PROVIDER,
  SERVICE_TYPE.STATE,
  SERVICE_TYPE.SECRETS,
] as ServiceTypeChoice[];

/**
 * @param {ServiceTypeChoice} type the type of service to check whether is a core service
 * @returns {Boolean} whether the given service type is a core service
 */
export const isCoreService = (
  type: ServiceTypeChoice,
): boolean => (
  CORE_SERVICE_TYPES.includes(type)
);

/**
 * Updates a service given certain attributes
 *
 * @param {Partial<Service>} attrs the service attributes to apply
 * @returns {Function<Service>} the updated service
 */
export const withServiceAttributes = <C extends BaseServiceAttributes>(
  attrs: Partial<Service<C>>,
) => <T extends Service<C>>(srv: T): T => ({
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
 *    associate(SERVICE_TYPE.PROVIDER, {
 *      scope: 'deployable',
 *      as: 'kmsKey',
 *      where: (cfg, providerCfg) => cfg.region === providerCfg.region && ....,
 *      handler: (cfg, stack) => stack.getProvisionsFromConfig(cfg).find(p => p instanceof KmsKey),
 *    }),
 *  )
 *
 * Which associate the current service (in our example AwsRdsService) with the "Provider" Service
 * for the `deployable` scope, under the alias `kmsKey`, when the criteria returned by `where`
 * match, using the `handler` function. The `handler` function returns the data to be used
 * as `requirements` when provisioning the service.
 *
 * @param {ServiceTypeChoice} from the (source) service to associate
 * @param {ServiceAssociation} association the association configuration
 * @see {ServiceAssociation}
 * @returns {Function<Service>}
 */
export const associate = <C extends BaseServiceAttributes>(
  from: ServiceTypeChoice, association: Omit<ServiceAssociation, 'from'>,
) => <T extends Service<C>>(service: T): T => ({
  ...service,
  associations: [...service.associations, { from, ...association }],
});

/**
 * Registers a handler to use when provisioning the service under a specific scope
 *
 * @param {ServiceScopeChoice} scope the scope to register the handler for
 * @param {ProvisionHandler} handler the handler that provisions the service
 * @returns {Function<Service>}
 */
export const onProvision = <C extends BaseServiceAttributes>(
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
export const environment = <C extends BaseServiceAttributes>(
  name: string, description: string, required: boolean = false,
) => <T extends Service<C>>(service: T): T => ({
  ...service,
  environment: [...service.environment, { name, required, description }],
});

/**
 * Enhances a service to support regions
 *
 * @param {String[]} regions the regions that the service can be provisioned in
 * @param {String} defaultRegion the default region to provision the service in
 * @returns {Function<Service>}
 */
export const inRegions = <C extends BaseServiceAttributes>(
  regions: readonly string[], defaultRegion: string,
) => pipe(
  withServiceAttributes({ regions }),
  withSchema<C, { region: string }>({
    type: 'object',
    properties: {
      region: {
        type: 'string',
        enum: regions,
        default: defaultRegion,
        errorMessage: `The region is invalid. Available options are: ${regions.join(', ')}`
      },
    },
  }),
);

/**
 * Adds size support to a service (eg. the database instance size)
 *
 * @param {string[]} sizes the available sizes for the service
 * @param {String} defaultSize the default size for the service
 * @returns {Function<Service>}
 */
export const sizeable = <C extends BaseServiceAttributes>(
  sizes: readonly string[], defaultSize: string,
) => withSchema<C, { size: string }>({
  type: 'object',
  properties: {
    size: {
      type: 'string',
      enum: sizes,
      default: defaultSize,
      errorMessage: `The size is invalid. Available options are: ${sizes.join(', ')}`
    },
  }
});

/**
 * Adds storage support to a service (eg. the database storage size)
 *
 * @param {Number} defaultValue the default value to use for storage
 * @param {Object} opts
 * @param {Number} opts.min the minimum size for the service's storage
 * @param {Number} opts.max the maximum size for the service's storage
 * @returns {Function<Service>}
 */
export const storeable = <C extends BaseServiceAttributes>(
  defaultValue = DEFAULT_SERVICE_STORAGE, { min = 1, max = 100_000 }: MinMax = {},
) => withSchema<C, { storage: number }>({
  type: 'object',
  properties: {
    storage: {
      type: 'number',
      minimum: min,
      maximum: max,
      default: defaultValue,
      errorMessage: `The storage should be between ${min} and ${max}`,
    },
  }
});

/**
 * Adds TCP port connection support to a service (eg. the port 3306 for a MySQL database)
 *
 * @param {Number} defaultPort the default port that the service accepts connections in
 * @param {Object} opts
 * @param {Number} opts.min the minimum port number
 * @param {Number} opts.max the maximum port number
 * @returns {Function<Service>}
 */
export const connectable = <C extends BaseServiceAttributes>(
  defaultPort: number, { min = 1, max = 65_535 }: MinMax = {},
) => withSchema<C, { port: number }>({
  type: 'object',
  properties: {
    port: {
      type: 'number',
      minimum: min,
      maximum: max,
      default: defaultPort,
      errorMessage: `The port should be between ${min} and ${max}`,
    },
  }
});

/**
 * Adds multiple-node support to a service (eg. multiple app server instances)
 *
 * @param {Number} defaultNodes the default number of nodes
 * @param {Object} opts
 * @param {Number} opts.min the minimum number of nodes
 * @param {Number} opts.max the maximum number of nodes
 * @returns {Function<Service>}
 */
export const multiNode = <C extends BaseServiceAttributes>(
  defaultNodes = 1, { min = 1, max = 10_000 }: MinMax = {},
) => withSchema<C, { nodes: number }>({
  type: 'object',
  properties: {
    nodes: {
      type: 'number',
      minimum: min,
      maximum: max,
      default: defaultNodes,
      errorMessage: `The nodes should be between ${min} and ${max}`,
    },
  }
});

/**
 * Adds version support to a service (eg. database version to run)
 *
 * @param {string} versions the versions available to the service
 * @param {String} defaultVersion the default version for the service
 * @returns {Function<Service>}
 */
export const versioned = <C extends BaseServiceAttributes>(
  versions: readonly string[], defaultVersion: string,
) => withSchema<C, { version: string }>({
  type: 'object',
  properties: {
    version: {
      type: 'string',
      enum: versions,
      default: defaultVersion,
    },
  }
});

/**
 * Adds engine support to a service (eg. database or cache engine to run)
 *
 * @param {string} engine the engine for the service
 * @returns {Function<Service>}
 */
export const ofEngine = <C extends BaseServiceAttributes>(
  engine: string,
) => withSchema<C, { engine: string }>({
  type: 'object',
  properties: {
    engine: {
      type: 'string',
      enum: [engine],
      default: engine,
      errorMessage: `The engine can only be ${engine}`,
    },
  }
});
