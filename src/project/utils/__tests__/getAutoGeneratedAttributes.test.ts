import { getFullStackProjectMock } from '@tests/mocks/project'
import { PROVIDER, SERVICE_TYPE } from '@src/constants'
import { ENVIRONMENT } from '@src/project/constants'
import { getAutoGeneratedAttributes } from '@src/project/utils/getAutoGeneratedAttributes'
import type { AwsApplicationAttributes } from '@src/services/providers/aws/services/application'
import type { ProjectConfiguration } from '@src/project/types'

describe('Auto generated attributes for services', () => {
  let project: ProjectConfiguration
  let appConfig: AwsApplicationAttributes
  const environment = ENVIRONMENT.PRODUCTION

  beforeEach(() => {
    project = getFullStackProjectMock()
    appConfig = Object.entries(project.environments.production || {})
      .map(([srvName, srvConfig]) => ({
        ...srvConfig,
        name: srvName,
      }))
      .find((srvConfig) => srvConfig.type === SERVICE_TYPE.APP) as AwsApplicationAttributes
  })

  it('provides the attributes for the state', () => {
    const stateAttributes = getAutoGeneratedAttributes(SERVICE_TYPE.STATE, project, environment)

    expect(stateAttributes).toEqual(
      expect.objectContaining({
        bucket: project.state.bucket,
        statePath: project.state.statePath,
        lockTable: project.state.lockTable,
        type: SERVICE_TYPE.STATE,
        provider: PROVIDER.AWS,
        name: expect.stringContaining('state'),
      }),
    )
  })

  it('provides the attributes for the cluster', () => {
    const clusterAttributes = getAutoGeneratedAttributes(
      SERVICE_TYPE.CLUSTER,
      project,
      environment,
      appConfig,
    )

    expect(clusterAttributes).toEqual(
      expect.objectContaining({
        type: SERVICE_TYPE.CLUSTER,
        provider: PROVIDER.AWS,
        clusterName: `${project.name}-${environment}`,
        region: 'eu-central-1',
        name: 'app-aws-eu-central-1-cluster',
      }),
    )
  })

  it('provides the attributes for the DNS service', () => {
    const dnsAttributes = getAutoGeneratedAttributes(
      SERVICE_TYPE.DNS,
      project,
      environment,
      appConfig,
    )

    expect(dnsAttributes).toEqual(
      expect.objectContaining({
        type: SERVICE_TYPE.DNS,
        provider: PROVIDER.AWS,
        name: 'stackmate-io-dns',
        domain: 'stackmate.io',
      }),
    )
  })

  it('provides the attributes for the SSL service', () => {
    const sslAttributes = getAutoGeneratedAttributes(
      SERVICE_TYPE.SSL,
      project,
      environment,
      appConfig,
    )

    expect(sslAttributes).toEqual(
      expect.objectContaining({
        type: SERVICE_TYPE.SSL,
        provider: PROVIDER.AWS,
        name: `${appConfig.name}-ssl-certificate`,
        domain: appConfig.domain,
      }),
    )
  })
})
