import { get } from 'lodash';

import AwsRdsService from '@stackmate/engine/providers/aws/services/rds';
import { AWS, CloudServiceConfiguration } from '@stackmate/engine/types';
import { PROVIDER, SERVICE_TYPE } from '@stackmate/engine/constants';
import { hashString, mergeJsonSchemas } from '@stackmate/engine/lib/helpers';
import { RDS_DEFAULT_VERSIONS_PER_ENGINE, RDS_ENGINES, RDS_MAJOR_VERSIONS_PER_ENGINE } from '@stackmate/engine/providers/aws/constants';

class AwsPostgreSqlService extends AwsRdsService<AWS.PostgreSQL.Attributes> implements AWS.PostgreSQL.Type {
  /**
   * @var {String} type the type for the service
   */
  readonly type = SERVICE_TYPE.POSTGRESQL;

  /**
   * @var {String} version the version to provision
   */
  version: string = RDS_DEFAULT_VERSIONS_PER_ENGINE.get('postgres')!;

  /**
   * @var {Number} port the port to use for connecting
   */
  port: number = 5432;

  /**
   * @var {String} engine the engine for the database
   */
  readonly engine: Extract<typeof RDS_ENGINES[number], 'postgres'> = 'postgres';

  /**
   * @returns {Object} provides the structure to generate the JSON schema by
   */
  static schema(): AWS.PostgreSQL.Schema {
    return mergeJsonSchemas(super.schema(), {
      properties: {
        type: {
          type: 'string',
          const: SERVICE_TYPE.POSTGRESQL,
        },
        version: {
          default: get(RDS_DEFAULT_VERSIONS_PER_ENGINE, 'postgres'),
          enum: get(RDS_MAJOR_VERSIONS_PER_ENGINE, 'postgres', []),
        },
        port: {
          default: 3306,
        },
      }
    });
  }

  /**
   * Returns the attributes to use when populating the initial configuration
   * @param {Object} options the options for the configuration
   * @returns {Object} the attributes
   */
  static config({ stageName = '' } = {}): CloudServiceConfiguration<AWS.PostgreSQL.Attributes> {
    return {
      provider: PROVIDER.AWS,
      type: SERVICE_TYPE.POSTGRESQL,
      name: [
        'postgresql-database',
        stageName ? hashString(stageName) : '',
      ].join('-'),
    };
  }
}

export default AwsPostgreSqlService;
