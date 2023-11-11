import { merge } from 'lodash'
import { ValidationError } from '@lib/errors'
import { getSchema, getValidData } from '@src/validation'
import { getAwsDbMock } from '@tests/mocks'
import type { ServiceAttributes } from '@services/registry'
import type { AwsMariaDBAttributes, AwsPostgreSQLAttributes } from '@aws/services/database'

describe('serviceLinks', () => {
  const schema = getSchema()
  const db1 = getAwsDbMock('mariadb') as AwsMariaDBAttributes
  const db2 = getAwsDbMock('postgresql') as AwsPostgreSQLAttributes

  const config: ServiceAttributes[] = [db1, db2]

  it('raises an error when the service links contain invalid entries', () => {
    const invalid = merge([], config, [{ links: ['some-invalid-link'] }])
    expect(() => getValidData(invalid, schema)).toThrow(ValidationError)
  })

  it('proceeds without an error for valid service links', () => {
    const links = [db2.name]
    const withLinks = merge([], config, [{ links }])

    const [serviceWithLinks] = getValidData(withLinks, schema)
    expect(serviceWithLinks).toMatchObject({ links: expect.arrayContaining(links) })
  })
})
