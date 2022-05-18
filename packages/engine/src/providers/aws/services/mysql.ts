import { get } from 'lodash';

import AwsRdsService from '@stackmate/engine/providers/aws/services/rds';
import { Attribute } from '@stackmate/engine/lib/decorators';
import { SERVICE_TYPE } from '@stackmate/engine/constants';
import { AwsDatabaseServiceSchema, AwsMySQLDatabaseSchema, AwsMySQLDatabaseService, JsonSchema, OneOf, ServiceTypeChoice } from '@stackmate/engine/types';
import { RDS_DEFAULT_VERSIONS_PER_ENGINE, RDS_ENGINES, RDS_MAJOR_VERSIONS_PER_ENGINE } from '@stackmate/engine/providers/aws/constants';
import { mergeJsonSchemas } from '@stackmate/engine/lib/helpers';

class AwsMysqlService extends AwsRdsService implements AwsMySQLDatabaseService {
  /**
   * @var {String} type the type for the service
   */
  readonly type: ServiceTypeChoice = SERVICE_TYPE.MYSQL;

  /**
   * @var {String} engine the engine for the database
   */
  @Attribute engine: OneOf<typeof RDS_ENGINES> = 'mysql';

  /**
   * @var {String} version the version to provision
   */
  @Attribute version: string = RDS_DEFAULT_VERSIONS_PER_ENGINE.get('mysql')!;

  /**
   * @var {Number} port the port to use for connecting
   */
  @Attribute port: number = 3306;

  /**
   * @returns {Object} provides the structure to generate the JSON schema by
   */
  static schema(): JsonSchema<AwsMySQLDatabaseSchema> {
    return mergeJsonSchemas<AwsDatabaseServiceSchema, AwsMySQLDatabaseSchema>(super.schema(), {
      properties: {
        type: {
          type: 'string',
          const: SERVICE_TYPE.MYSQL,
        },
        engine: {
          type: 'string',
          const: 'mysql',
        },
        version: {
          type: 'string',
          default: RDS_DEFAULT_VERSIONS_PER_ENGINE.get('mysql'),
          enum: get(RDS_MAJOR_VERSIONS_PER_ENGINE, 'mysql', []),
        },
        port: {
          type: 'number',
          default: 3306,
          minimum: 0,
          maximum: 65535,
        },
      }
    });
  }
}

export default AwsMysqlService;
