import * as yup from 'yup';
import { Schema } from 'yup';

const DEFINITION_PREFIX = 'yup.';

/**
 * Checks if the given value is an array which first value is a string
 * that starts with the definition prefix ("yup.").
 *
 * @param value
 */
const isYupCallDefinition = (value: any): boolean => (
  Array.isArray(value)
  && typeof value[0] === 'string'
  && value[0].startsWith(DEFINITION_PREFIX)
);

/**
 * Checks if the given value is an array of yup call definitions.
 * This just assumes that when the first element is one, the rest are as well.
 *
 * @param value
 */
const isYupSchemaDefinition = (value: any): boolean => (
  Array.isArray(value) && isYupCallDefinition(value[0])
);

/**
 * Transforms the given schema JSON into a schema instance.
 * This expects a valid yup array.
 *
 * @param {array} json
 * @param {object} instance
 */
const transformSchema = (json: any[], instance: typeof yup): Schema<any> => {
  const mapArgument = (argument: any) => {
    if (isYupSchemaDefinition(argument)) {
      return transformSchema(argument, instance);
    }

    // Support nested structures (e.g. an array of schemas like '[ [[...]], [[...]], ...]')
    if (Array.isArray(argument)) {
      return argument.map(mapArgument);
    }

    // Check if the given object is actually a plain object
    // This fixes problems with e.g. regex instances
    if (Object.prototype.toString.call(argument) === '[object Object]') {
      return transformObject(argument, instance);
    }

    return argument;
  };

  return json.reduce((schema, value: [string]) => {
    const [name, ...args] = value;

    // Grab the real method name
    const method = name.substr(DEFINITION_PREFIX.length);

    // Call the method with transformed parameters
    return schema[method](...args.map(mapArgument));
  }, instance);
};

/**
 * Transforms the given object into an object
 * containing yup schemas as values.
 *
 * @param {object} json
 * @param {object} instance An optional yup instance
 * @return {object} The original object with its values replaced by yup validators
 */
export function transformObject<T extends object, R extends {
  [P in keyof T]: Schema<any>
}>(json: T, instance = yup): R {
  return Object.entries(json).reduce(
    (obj, [key, value]) => ({
      ...obj,
      // Only transform possible schemas and leave the rest be (fixes calls like when())
      [key]: isYupSchemaDefinition(value)
        ? transformSchema(value, instance)
        : value,
    }),
    {} as R,
  );
}

/**
 * Transforms the given schema definition array into a yup schema.
 *
 * @param json
 * @param instance An optional yup instance
 */
export function transformAll<T = any>(json: any[], instance = yup): Schema<T> {
  const wrapped = Array.isArray(json[0]) ? json : [json];

  if (!isYupSchemaDefinition(wrapped)) {
    return instance.mixed();
  }

  return transformSchema(wrapped, instance);
}
