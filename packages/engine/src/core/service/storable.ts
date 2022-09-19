import { MinMax } from '@stackmate/engine/lib';
import { DEFAULT_SERVICE_STORAGE } from '@stackmate/engine/constants';
import { BaseServiceAttributes, withSchema } from './core';

/**
 * @type {StorableAttributes} storage specific attributes
 */

export type StorableAttributes = { storage: number; };
/**
 * Adds storage support to a service (eg. the database storage size)
 *
 * @param {Number} defaultValue the default value to use for storage
 * @param {Object} opts
 * @param {Number} opts.min the minimum size for the service's storage
 * @param {Number} opts.max the maximum size for the service's storage
 * @returns {Function<Service>}
 */

export const storable = <C extends BaseServiceAttributes>(
  defaultValue = DEFAULT_SERVICE_STORAGE, { min = 1, max = 100000 }: MinMax = {}
) => withSchema<C, StorableAttributes>({
  type: 'object',
  properties: {
    storage: {
      type: 'number',
      minimum: min,
      maximum: max,
      default: defaultValue,
      errorMessage: `The storage should be between ${min} and ${max}`,
    },
  }
});