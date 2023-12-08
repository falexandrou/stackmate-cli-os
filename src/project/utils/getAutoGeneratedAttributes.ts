import path from 'node:path'
import { SERVICE_TYPE } from '@src/constants'
import { isFunction, isString, kebabCase } from 'lodash'
import { DEFAULT_PROVIDER, DEFAULT_REGION } from '@src/project/constants'
import { getTopLevelDomain } from '@src/lib/domain'
import type { ServiceConfiguration } from '@src/services/registry'
import type { BaseServiceAttributes, ServiceTypeChoice } from '@src/services/types'
import type { ProjectConfiguration } from '@src/project/types'

export type AttributesGenerator = (
  project: ProjectConfiguration,
  environment?: string,
  associated?: BaseServiceAttributes,
) => BaseServiceAttributes | null

const hasDomain = (
  config?: BaseServiceAttributes,
): config is BaseServiceAttributes & { domain: string } =>
  !!config && 'domain' in config && isString(config.domain) && Boolean(config.domain)

const ATTRIBUTE_GENERATOR: Partial<Record<ServiceTypeChoice, AttributesGenerator>> = {
  [SERVICE_TYPE.DNS]: (project, environment, associated) => {
    if (!hasDomain(associated)) {
      return null
    }

    const tld = getTopLevelDomain(associated.domain)
    return {
      type: SERVICE_TYPE.DNS,
      provider: associated.provider || project.provider || DEFAULT_PROVIDER,
      region: associated.region || project.region,
      domain: tld,
      name: kebabCase(`${tld}-dns`),
    }
  },
  [SERVICE_TYPE.SSL]: (project, environment, associated) => {
    if (!hasDomain(associated)) {
      return null
    }

    return {
      type: SERVICE_TYPE.SSL,
      provider: associated.provider || project.provider || DEFAULT_PROVIDER,
      domain: associated.domain,
      name: kebabCase(`${associated.name}-ssl-certificate`),
    }
  },
  [SERVICE_TYPE.STATE]: (project) => {
    const provider = project.state.provider || project.provider || DEFAULT_PROVIDER

    return {
      ...project.state,
      type: SERVICE_TYPE.STATE,
      provider,
      name: 'project-state',
      region: project.state.region || project.region || DEFAULT_REGION[provider],
    }
  },
  [SERVICE_TYPE.CLUSTER]: (project, environment, associated) => {
    const provider = associated?.provider || project.provider || DEFAULT_PROVIDER
    const region = associated?.region || project.region
    return {
      name: kebabCase(`app-${provider}-${region ? `${region}-` : ''}cluster`),
      type: SERVICE_TYPE.CLUSTER,
      provider,
      region,
      clusterName: kebabCase(
        `${project.name || path.basename(process.cwd()) || 'stackmate-app'}-${environment}`,
      ),
    }
  },
}

export const getAutoGeneratedAttributes = (
  type: ServiceTypeChoice,
  project: ProjectConfiguration,
  environment: string,
  associatedServiceConfig?: BaseServiceAttributes,
): ServiceConfiguration | null => {
  const generator = ATTRIBUTE_GENERATOR[type]

  if (isFunction(generator)) {
    return generator(project, environment, associatedServiceConfig) as ServiceConfiguration
  }

  const provider = associatedServiceConfig?.provider || project.provider || DEFAULT_PROVIDER
  const region = associatedServiceConfig?.region || project.region
  const requiredServiceName = `${provider}-${type}-service`

  return {
    name: requiredServiceName,
    provider,
    type,
    region,
  } as ServiceConfiguration
}