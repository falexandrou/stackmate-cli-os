import path from 'node:path'
import { SERVICE_TYPE } from '@src/constants'
import { isFunction, isString, kebabCase } from 'lodash'
import { DEFAULT_PROVIDER } from '@src/project/constants'
import { getTopLevelDomain } from '@src/lib/domain'
import type { ServiceConfiguration } from '@src/services/registry'
import type { BaseServiceAttributes, ServiceTypeChoice } from '@src/services/types'
import type { ProjectConfiguration } from '@src/project/types'

export type AttributesGenerator = (
  project: ProjectConfiguration,
  environment?: string,
  associated?: BaseServiceAttributes,
) => BaseServiceAttributes | null

const domainCopy: AttributesGenerator = (project, environment, associated) => {
  if (
    !associated ||
    !('domain' in associated) ||
    !isString(associated.domain) ||
    !associated.domain
  ) {
    return null
  }

  return {
    type: SERVICE_TYPE.DNS,
    provider: associated.provider || project.provider || DEFAULT_PROVIDER,
    region: associated.region || project.region,
    domain: getTopLevelDomain(associated.domain),
    name: kebabCase(
      `${project.name || path.basename(process.cwd()) || 'stackmate-app'}-${environment}`,
    ),
  }
}

const ATTRIBUTE_GENERATOR: Partial<Record<ServiceTypeChoice, AttributesGenerator>> = {
  [SERVICE_TYPE.DNS]: domainCopy,
  [SERVICE_TYPE.SSL]: domainCopy,
  [SERVICE_TYPE.STATE]: (project) => ({
    ...project.state,
    type: SERVICE_TYPE.STATE,
    provider: project.state.provider || project.provider || DEFAULT_PROVIDER,
    name: 'project-state',
  }),
  [SERVICE_TYPE.CLUSTER]: (project, environment, associated) => ({
    type: SERVICE_TYPE.CLUSTER,
    provider: associated?.provider || project.provider || DEFAULT_PROVIDER,
    region: associated?.region || project.region,
    name: kebabCase(
      `${project.name || path.basename(process.cwd()) || 'stackmate-app'}-${environment}`,
    ),
  }),
}

export const getAutoGeneratedAttributes = (
  type: ServiceTypeChoice,
  project: ProjectConfiguration,
  environment: string,
  associatedServiceConfig?: BaseServiceAttributes,
): ServiceConfiguration => {
  const generator = ATTRIBUTE_GENERATOR[type]
  const generated = isFunction(generator)
    ? generator(project, environment, associatedServiceConfig)
    : null

  const provider = associatedServiceConfig?.provider || project.provider || DEFAULT_PROVIDER
  const region = associatedServiceConfig?.region || project.region
  const requiredServiceName = `${provider}-${type}-service`

  return {
    name: requiredServiceName,
    provider,
    type,
    region,
    ...generated,
  } as ServiceConfiguration
}
