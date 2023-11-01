import {
  kmsKey,
  provider as terraformAwsProvider,
  internetGateway as awsInternetGateway,
  subnet as awsSubnet,
  vpc as awsVpc,
} from '@cdktf/provider-aws'

import type {
  AwsProviderDeployableResources,
  AwsProviderAttributes,
  AwsProviderDeployableProvisionable,
  AwsProviderDestroyableResources,
  AwsProviderPreparableProvisionable,
  AwsProviderPreparableResources,
  AwsProviderDestroyableProvisionable,
} from '@providers/aws/services/provider'
import { AwsProvider } from '@providers/aws/services/provider'
import { DEFAULT_REGION, REGIONS } from '@providers/aws/constants'
import { PROVIDER, SERVICE_TYPE } from '@constants'
import type { BaseProvisionable, ServiceScopeChoice } from '@core/service'
import type { Stack } from '@core/stack'
import { getStack } from '@core/stack'
import { getProvisionable } from '@core/operation'

describe('AWS Provider', () => {
  const service = AwsProvider

  it('is a valid AWS provider service', () => {
    expect(service.provider).toEqual(PROVIDER.AWS)
    expect(service.type).toEqual(SERVICE_TYPE.PROVIDER)
  })

  it('has the AWS regions set', () => {
    expect(new Set(service.regions)).toEqual(new Set(REGIONS))
  })

  it('has the handlers registered', () => {
    const scopes: ServiceScopeChoice[] = ['deployable', 'destroyable', 'preparable']
    expect(new Set(Array.from(service.handlers.keys()))).toEqual(new Set(scopes))
    expect(Array.from(service.handlers.values()).every((h) => typeof h === 'function')).toBe(true)
  })

  it('contains a valid schema', () => {
    expect(service.schema).toMatchObject({
      $id: 'services/aws/provider',
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {
        provider: {
          type: 'string',
          enum: [PROVIDER.AWS],
          default: PROVIDER.AWS,
        },
        type: {
          type: 'string',
          enum: [SERVICE_TYPE.PROVIDER],
          default: SERVICE_TYPE.PROVIDER,
        },
        region: {
          type: 'string',
          enum: Array.from(REGIONS),
          default: DEFAULT_REGION,
        },
        profile: { type: 'string', default: 'default', serviceProfile: true },
        overrides: { type: 'object', default: {}, serviceProfileOverrides: true },
      },
    })
  })

  describe('provision handlers', () => {
    let stack: Stack
    let provisionable: BaseProvisionable
    let config: AwsProviderAttributes

    beforeEach(() => {
      stack = getStack('my-project', 'a-stage')
      config = {
        provider: 'aws',
        name: 'aws-provider',
        type: SERVICE_TYPE.PROVIDER,
        region: 'eu-central-1',
      }

      provisionable = getProvisionable(config)
    })

    it('registers the service into the stack and creates the deployable provisions', () => {
      const deployHandler = service.handlers.get('deployable')!
      expect(typeof deployHandler === 'function').toBe(true)

      const resources = deployHandler(
        provisionable as AwsProviderDeployableProvisionable,
        stack,
      ) as AwsProviderDeployableResources

      expect(resources).toBeInstanceOf(Object)
      expect(new Set(Object.keys(resources))).toEqual(
        new Set(['gateway', 'account', 'kmsKey', 'vpc', 'provider', 'subnets', 'outputs']),
      )
      expect(resources.gateway).toBeInstanceOf(awsInternetGateway.InternetGateway)
      expect(resources.kmsKey).toBeInstanceOf(kmsKey.KmsKey)
      expect(resources.vpc).toBeInstanceOf(awsVpc.Vpc)
      expect(resources.provider).toBeInstanceOf(terraformAwsProvider.AwsProvider)
      expect(Array.isArray(resources.subnets)).toBe(true)
      expect(resources.subnets.every((s) => s instanceof awsSubnet.Subnet)).toBe(true)
    })

    it('registers the service into the stack and creates the destroyable provisions', () => {
      const destroyHandler = service.handlers.get('destroyable')!
      expect(typeof destroyHandler === 'function').toBe(true)

      const resources = destroyHandler(
        provisionable as AwsProviderDestroyableProvisionable,
        stack,
      ) as AwsProviderDestroyableResources

      expect(resources).toBeInstanceOf(Object)
      expect(new Set(Object.keys(resources))).toEqual(
        new Set(['provider', 'account', 'kmsKey', 'outputs']),
      )
      expect(resources.provider).toBeInstanceOf(terraformAwsProvider.AwsProvider)
    })

    it('registers the base resources', () => {
      const prepareHandler = service.handlers.get('preparable')!
      expect(typeof prepareHandler === 'function').toBe(true)

      const resources = prepareHandler(
        provisionable as AwsProviderPreparableProvisionable,
        stack,
      ) as AwsProviderPreparableResources

      expect(resources).toBeInstanceOf(Object)
      expect(new Set(Object.keys(resources))).toEqual(
        new Set(['provider', 'account', 'kmsKey', 'outputs']),
      )
      expect(resources.provider).toBeInstanceOf(terraformAwsProvider.AwsProvider)
      expect(resources.kmsKey).toBeInstanceOf(kmsKey.KmsKey)
    })
  })
})