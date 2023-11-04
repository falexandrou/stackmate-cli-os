import type { PROVIDER, SERVICE_TYPE } from '@constants'
import type { ChoiceOf } from '@lib/util'

/**
 * @type {ProviderChoice} a provider choice
 */

export type ProviderChoice = ChoiceOf<typeof PROVIDER>
/**
 * @type {ServiceTypeChoice} a service type choice
 */

export type ServiceTypeChoice = ChoiceOf<typeof SERVICE_TYPE>

/**
 * @type {ServiceEnvironment} the environment variable required by a service
 */

export type ServiceEnvironment = {
  name: string
  required: boolean
  description?: string
}
/**
 * @type {BaseServiceAttributes} Base attributes for any service in the system
 */

export type BaseServiceAttributes = {
  name: string
  provider: ProviderChoice
  type: ServiceTypeChoice
  region?: string
}
