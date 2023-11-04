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

// Service defaults
export const DEFAULT_RESOURCE_COMMENT = 'Deployed by Stackmate'
export const DEFAULT_PROFILE_NAME = 'default' as const
export const DEFAULT_SERVICE_STORAGE = 30 as const
export const DEFAULT_PASSWORD_LENGTH = 16 as const
