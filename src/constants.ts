import os from 'node:os'
import { join } from 'node:path'
import { omit } from 'lodash'

export const { env: ENV } = process
export const STACKMATE_DIRECTORY = '.stackmate'
export const DEFAULT_PROJECT_NAME = 'stackmate-project'
export const DEFAULT_RESOURCE_COMMENT = 'Deployed by Stackmate'
export const USER_HOME_DIRECTORY = join(os.homedir(), STACKMATE_DIRECTORY)
export const DEBUG_MODE = Boolean(ENV.DEBUG) || false

export const PROVIDER = {
  AWS: 'aws',
  LOCAL: 'local',
} as const

export const SERVICE_TYPE = {
  CDN: 'cdn',
  DNS: 'dns',
  OBJECT_STORAGE: 'objectstore',
  INSTANCE: 'instance',
  LOAD_BALANCER: 'loadbalancer',
  MEMCACHED: 'memcached',
  MAILER: 'mailer',
  MARIADB: 'mariadb',
  MONITORING: 'monitoring',
  MYSQL: 'mysql',
  POSTGRESQL: 'postgresql',
  PROVIDER: 'provider',
  REDIS: 'redis',
  SSL: 'ssl',
  STATE: 'state',
  SECRETS: 'secrets',
  VOLUME: 'volume',
} as const

export const CLOUD_PROVIDER = omit({ ...PROVIDER }, 'LOCAL')

// Service defaults
export const DEFAULT_PROFILE_NAME = 'default' as const
export const DEFAULT_SERVICE_STORAGE = 30 as const
export const DEFAULT_CLOUD_PROVIDER = PROVIDER.AWS
export const DEFAULT_PASSWORD_LENGTH = 16 as const
