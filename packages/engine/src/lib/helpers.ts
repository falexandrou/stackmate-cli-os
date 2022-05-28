import fs from 'fs';
import crypto from 'crypto';
import wordGenerator from 'project-name-generator';
import { Address4 } from 'ip-address';
import { ComplementOf, JsonSchema, } from '@stackmate/engine/types';
import { isObject, merge, sampleSize, uniq } from 'lodash';

/**
 * Returns an MD5 hash of a string
 *
 * @param {String} str the string to create a hash from
 * @returns {String} the md5 hash
 */
export const hashString = (str: string): string => (
  crypto.createHash('md5').update(str).digest('hex').toString()
);

/**
 * Returns an MD5 hash of an object
 *
 * @param {Object} obj the object to create a hash from
 * @returns {String} the md5 hash
 */
export const hashObject = (obj: object): string => (
  hashString(JSON.stringify(obj))
);

/**
 * Creates a directory if it doesn't exist
 *
 * @param {String} path the path to create (if doesn't exist)
 * @void
 */
export const createDirectory = (path: string): void => {
  const exists = fs.existsSync(path);

  if (exists && !fs.statSync(path).isDirectory()) {
    throw new Error(`Path ${path} already exists and it's not a directory`);
  }

  fs.mkdirSync(path, { recursive: true, mode: 0o700 });
};

/**
 * Returns whether the given object is a subset of another object
 *
 * @param {Object} subObj the subset object
 * @param {Object} superObj the superset object
 * @returns {Boolean}
 */
export const isKeySubset = (subObj: any, superObj: any): boolean => (
  Object.keys(subObj).every((key) => {
    if (isObject(subObj[key])) {
      return isKeySubset(superObj[key], subObj[key]);
    }

    return key in subObj && key in superObj;
  })
);

/**
 * Returns a list of CIDR blocks based on a single IP
 *
 * @param {String} ip the IP address to base the CIDR blocks from
 * @param {Number} bitmask the bit mask to use
 * @param {Number} subnets the number of subnets to launch
 * @param {Number} subnetBitmask the bitmask to use for the subnets
 * @returns {Array<string>} the list of CIDR blocks
 */
export const getNetworkingCidrBlocks = (
  ip: string, bitmask: number = 16, subnets: number = 2, subnetBitmask: number = 24,
): Array<string> => {
  const cidrBlocks: Array<string> = [];
  const root = new Address4(`${ip}/${bitmask}`);
  cidrBlocks.push(
    `${root.startAddress().address}/${bitmask}`,
  );

  const [firstOctet, secondOctet] = root.toArray();
  Array.from(Array(subnets).keys()).map((num) => {
    const subnetIp = [firstOctet, secondOctet, String(num + 1), String(0)].join('.')
    cidrBlocks.push(`${subnetIp}/${subnetBitmask}`);
  });

  return cidrBlocks;
};

/**
 * Generates a random string
 *
 * @param {Object} opts
 * @param {Number} opts.length the length of the generated string
 * @param {Boolean} opts.special whether to allow special characters or not
 * @param {String[]} opts.exclude the list of characters to exclude
 * @returns {String} the generated string
 */
export const getRandomString = ({
  length = 16,
  special = true,
  safe = true,
  exclude = [],
}: {
  length?: number;
  special?: Boolean;
  safe?: Boolean;
  exclude?: string[];
} = {}): string => {
  const unsafe = '\',.|`/"';
  const alphanumeric = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const specialCharacters = '!#$%&()*+:;-<=>?@[]^_{}~';
  const characters = [...alphanumeric.split('')];

  if (special) {
    characters.push(...specialCharacters.split(''));

    if (!safe) {
      characters.push(...unsafe.split(''));
    }
  }

  return sampleSize(characters, length).join('');
};

/**
 * Merges two JSON schemas into one
 *
 * @param {Object} source the source schema
 * @param {Object} target the target schema
 * @returns {Object} the final schema
 */
export const mergeJsonSchemas = <Base extends Partial<T>, T extends Base>(
  source: JsonSchema<Base>,
  target: JsonSchema<ComplementOf<Base, T>>,
): JsonSchema<T> => {
  const {
    properties: sourceProperties,
    required: sourceRequired = [],
    ...sourceProps
  } = source;

  const {
    properties: targetProperties,
    required: targetRequired = [],
    ...targetProps
  } = target;

  return {
    ...merge({}, sourceProps, targetProps),
    properties: merge({}, sourceProperties, targetProperties),
    required: uniq([...sourceRequired, ...targetRequired]),
  };
};

/**
 * Generates a random string that kind of makes sense
 *
 * @param {Object} options the options for the generation
 * @param {String} options.prefix any prefix to include to the generated words
 * @param {Number} options.words the number of words to generate
 * @param {String} options.suffix any prefix to include to the generated words
 * @returns {String} the generated words
 */
export const generateWords = (
  { prefix = '', words = 2, suffix = '' }: { prefix?: string, words?: number, suffix?: string } = {},
): string => (
  `${prefix}${wordGenerator({ words }).dashed}`
);

/**
 * Returns an identifier that is highly likely to be unique
 *
 * @param {String} prefix any prefix to use
 * @param {object} hashable the hashable object
 * @param {String} separator the separator to use for joining the parts
 * @returns {String} the unique identifier
 */
export const uniqueIdentifier = (
  prefix = '', hashable: object = {}, separator: string = '-',
): string => {
  const uuid = crypto.randomUUID();
  const hash = hashObject(hashable);
  return [prefix, hashString(`${uuid}${hash}`)].join(separator);
};
