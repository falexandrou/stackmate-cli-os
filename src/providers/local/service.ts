import pipe from 'lodash/fp/pipe'
import type { provider as terraformLocalProvider } from '@cdktf/provider-local'

import { PROVIDER, SERVICE_TYPE } from '@constants'
import type {
  LocalProviderAttributes,
  LocalProviderProvisionable,
} from '@providers/local/services/provider'
import type {
  BaseServiceAttributes,
  Service,
  ServiceAssociations,
  ServiceRequirement,
  ServiceTypeChoice,
} from '@core/service'
import { associate, getCoreService } from '@core/service'
import type { Obj } from '@lib/util'

type ProviderRequirement = ServiceRequirement<
  terraformLocalProvider.LocalProvider,
  typeof SERVICE_TYPE.PROVIDER
>

export type LocalServiceAssociations = {
  preparable: {
    providerInstance: ProviderRequirement
  }
}

export type LocalServiceAttributes<Attrs extends BaseServiceAttributes> = Attrs & {
  provider: typeof PROVIDER.LOCAL
}

export type LocalService<
  Attrs extends BaseServiceAttributes,
  Assocs extends ServiceAssociations = Obj,
> = Service<LocalServiceAttributes<Attrs>, LocalServiceAssociations & Assocs>

/**
 * @var {LocalServiceAssociations} associations Service Associations applied to all local services
 */
const associations: LocalServiceAssociations = {
  preparable: {
    providerInstance: {
      with: SERVICE_TYPE.PROVIDER,
      requirement: true,
      where: (config: LocalProviderAttributes, linked: BaseServiceAttributes) =>
        config.provider === linked.provider,
      handler: (p: LocalProviderProvisionable): terraformLocalProvider.LocalProvider => {
        return p.provisions.provider
      },
    },
  },
}

export const getLocalService = (type: ServiceTypeChoice) =>
  pipe(associate(associations))(getCoreService(PROVIDER.LOCAL, type))
