import { LocalBackend } from 'cdktf'
import type { LocalStateAttributes, LocalStateProvisionable } from '@providers/local/services/state'
import { LocalState, onPrepare } from '@providers/local/services/state'
import { PROVIDER, SERVICE_TYPE } from '@constants'
import { getProvisionable } from '@core/operation'
import { Stack } from '@core/stack'

describe('Local state', () => {
  const service = LocalState

  it('is a valid local state service', () => {
    expect(service.provider).toEqual(PROVIDER.LOCAL)
    expect(service.type).toEqual(SERVICE_TYPE.STATE)
  })

  it('has the handlers registered only for the preparable scope', () => {
    expect(service.handlers.get('preparable')).toEqual(onPrepare)
    expect(service.handlers.get('deployable')).toBeUndefined()
    expect(service.handlers.get('destroyable')).toBeUndefined()
  })

  it('provides the right schema', () => {
    expect(service.schema).toMatchObject({
      $id: 'services/local/state',
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {
        provider: {
          type: 'string',
          enum: [PROVIDER.LOCAL],
          default: PROVIDER.LOCAL,
        },
        type: {
          type: 'string',
          enum: [SERVICE_TYPE.STATE],
          default: SERVICE_TYPE.STATE,
        },
        region: {
          type: 'string',
        },
      },
    })
  })

  describe('onPrepare provision handler', () => {
    const stack = new Stack('stack-name')
    const config: LocalStateAttributes = {
      name: 'local-state',
      provider: 'local',
      type: 'state',
    }

    const provisionable = getProvisionable(config)

    it('registers the local state backend', () => {
      const resources = onPrepare(provisionable as LocalStateProvisionable, stack)
      expect(resources).toBeInstanceOf(Object)
      expect(Object.keys(resources)).toEqual(['backend'])
      expect(resources.backend).toBeInstanceOf(LocalBackend)
    })
  })
})
