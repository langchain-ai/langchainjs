import 'reflect-metadata'

// ############### //
// ## CONSTANTS ## //
// ############### //

const KEY_DESIGN_TYPE = 'design:type';
const KEY_FUNC_OPTIONS = Symbol('openai:function_name');
const KEY_PROP_OPTIONS = Symbol('openai:prop_options');
const KEY_CLASS_KEYS = Symbol('openai:class_props');
const KEY_PROP_OPTIONAL = Symbol('openai:prop_optional');

// ########### //
// ## ENUMS ## //
// ########### //

export enum EStringFormat {
  /**
   * Date and time together
   * @example "2018-11-13T20:20:39+00:00"
   * @link https://tools.ietf.org/html/rfc3339#section-5.6
   */
  DATE_TIME = 'date-time',

  /**
   * Time
   * @example "20:20:39+00:00"
   * @link https://tools.ietf.org/html/rfc3339#section-5.6
   */
  TIME = 'time',

  /**
   * Date
   * @example "2018-11-13"
   * @link https://tools.ietf.org/html/rfc3339#section-5.6
   */
  DATE = 'date',

  /**
   * A duration as defined by the ISO 8601 ABNF for "duration".
   * @example "P3D" // expresses a duration of 3 days.
   * @link https://datatracker.ietf.org/doc/html/rfc3339#appendix-A
   */
  DURATION = 'duration',

  /**
   * Internet email address
   * @link http://tools.ietf.org/html/rfc5321#section-4.1.2
   */
  EMAIL = 'email',

  /**
   * The internationalized form of an Internet email address
   * @link https://tools.ietf.org/html/rfc6531
   */
  IDN_EMAIL = 'idn-email',

  /**
   * Internet host name
   * @link https://datatracker.ietf.org/doc/html/rfc1123#section-2.1
   */
  HOSTNAME = 'hostname',

  /**
   * An internationalized Internet host name
   * @link https://tools.ietf.org/html/rfc5890#section-2.3.2.3
   */
  IDN_HOSTNAME = 'idn-hostname',

  /**
   * IPv4 address, according to dotted-quad ABNF syntax
   * @link http://tools.ietf.org/html/rfc2673#section-3.2
   */
  IPV4 = 'ipv4',

  /**
   * IPv6 address
   * @link http://tools.ietf.org/html/rfc2373#section-2.2
   */
  IPV6 = 'ipv6',

  /**
   * A Universally Unique Identifier
   * @example "3e4666bf-d5e5-4aa7-b8ce-cefe41c7568a"
   * @link https://datatracker.ietf.org/doc/html/rfc4122
   */
  UUID = 'uuid',

  /**
   * A URI Reference (either a URI or a relative-reference)
   * @link http://tools.ietf.org/html/rfc3986#section-4.1
   */
  URI_REFERENCE = 'uri-reference',

  /**
   * The internationalized equivalent of a "uri"
   * @link https://tools.ietf.org/html/rfc3987
   */
  IRI = 'iri',

  /**
   * The internationalized equivalent of a "uri-reference"
   * @link https://tools.ietf.org/html/rfc3987
   */
  IRI_REFERENCE = 'iri-reference',

  /**
   * A URI Template (of any level) according to RFC6570. If you don't already know what a URI Template is, you probably don't need this value.
   * @link https://tools.ietf.org/html/rfc6570
   */
  URI_TEMPLATE = 'uri-template',

  /**
   * A JSON Pointer, according to RFC6901. There is more discussion on the use of JSON Pointer within JSON Schema in Structuring a complex schema. Note that this should be used only when the entire string contains only JSON Pointer content, e.g. `/foo/bar`. JSON Pointer URI fragments, e.g. `#/foo/bar/` should use `"uri-reference"`.
   * @link https://tools.ietf.org/html/rfc6901
   */
  JSON_POINTER = 'json-pointer',

  /**
   * A relative `JSON pointer`
   */
  RELATIVE_JSON_POINTER = 'relative-json-pointer',

  /**
   * A regular expression, which should be valid according to the ECMA 262 dialect.
   * @link https://www.ecma-international.org/publications-and-standards/standards/ecma-262/
   */
  REGEX = 'regex',
}


// ########### //
// ## TYPES ## //
// ########### //

export interface OpenAiFunctionOptions {
  name?: string;
  description: string;
}

type Constructor<T> = {
  new (...args: unknown[]): T;
}

type Enum<T> = {
  [key in keyof T]: T[key];
};

export type PropertyOptions<Schema extends GenericSchema<unknown>> = Partial<
  Omit<Schema, 'type' | 'description' | 'enum'>
>;

interface GenericSchema<T> {
  title?: string;
  description?: string;
  default?: T;
  examples?: T[];
  enum?: T[];
}

export interface NullSchema extends GenericSchema<null> {
  type: 'null';
}
export interface ArraySchema extends GenericSchema<unknown[]> {
  type: 'array';
  items: Record<string, unknown>;
  prefixItems?: Record<string, unknown>[];
}

export interface StringSchema extends GenericSchema<string> {
  type: 'string';
  pattern?: RegExp;
  minLength?: number;
  maxLength?: number;
  format?: EStringFormat;
}

export interface ObjectSchema extends GenericSchema<object> {
  type: 'object';
  properties?: Record<string, unknown>;
  required?: string[];
  minProperties?: number;
  maxProperties?: number;
  additionalProperties?: boolean | { type: 'string' | 'boolean' | 'number' | 'array' | 'object' };
}

export interface BooleanSchema extends GenericSchema<boolean> {
  type: 'boolean';
}

export interface NumberSchema extends GenericSchema<number> {
  type: 'number' | 'integer' | 'float';
  multipleOf?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMaximum?: boolean;
}

// ###################### //
// ## HELPER FUNCTIONS ## //
// ###################### //

const handleType = (type: Constructor<unknown>) => {
  const type_name = type.name.toLowerCase();

  if (!['string', 'boolean', 'number', 'array'].includes(type_name)) {
    const proto_keys: string[] = Reflect.getMetadata(KEY_CLASS_KEYS, type.prototype) ?? [];

    const properties = proto_keys.reduce(
      (acc, key) => {
        acc[key] = Reflect.getMetadata(KEY_PROP_OPTIONS, type.prototype, key);
        return acc;
      },
      {} as Record<string, unknown>,
    );

    return {
      type: 'object',
      properties,
    };
  }

  return {
    type: type_name,
  };
};

const pushClassKey = (target: object, propertyKey: string | symbol) => {
  // Push property list to prototype metadata
  // This helps getting class keys, since they are not accessible on a non-initialized class
  const class_props: (string | symbol)[] = Reflect.getMetadata(KEY_CLASS_KEYS, target) ?? [];
  class_props.push(propertyKey);
  Reflect.defineMetadata(KEY_CLASS_KEYS, class_props, target);
};

const titleCase = (str: string): string =>
  str
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (s) => s.toUpperCase());


// ################ //
// ## DECORATORS ## //
// ################ //

/**
 * Represents a decorator to define an array property.
 *
 * @param {string} description - The description of the property.
 * @param {Constructor<object>[]} types - An array of types allowed in the array.
 * @param {PropertyOptions<ArraySchema>} [options] - Optional additional options for the property.
 * @returns {PropertyDecorator} - The decorator function.
 * @throws {Error} - If the provided type array is empty.
 * @throws {Error} - If tuple styled responses are used.
 */
export const AiArray =
  (description: string, types: Constructor<object>[], options?: PropertyOptions<ArraySchema>): PropertyDecorator =>
    (target: object, propertyKey: string | symbol) => {
      pushClassKey(target, propertyKey);

      if (types.length === 0) {
        throw new Error('The provided type array is empty. Provide at least one type for the array.');
      }

      const json_schema: ArraySchema = {
        type: 'array',
        title: titleCase(propertyKey.toString()),
        items: {},
        description,
        ...options,
      };

      if (types.length > 1) {
        throw new Error(
          'Tuples are not supported. If you need a tuple styled response, better to use AiObject.',
        );
      } else {
        json_schema.items = handleType(types[0]);
      }

      if (types?.length)
        // Set OpenAI properties
        Reflect.defineMetadata(KEY_PROP_OPTIONS, json_schema, target, propertyKey);
    };

/**
 * There are two numeric types in JSON Schema: integer and number. They share the same validation keywords.
 *
 * @param {string} description - The description of the property.
 * @param {PropertyOptions<NumberSchema>} [options] - The additional options for the property.
 * @returns {PropertyDecorator} - The decorator function.
 */
export const AiNumber =
  (
    description: string,
    options?: PropertyOptions<NumberSchema> & { type?: 'number' | 'integer' },
  ): PropertyDecorator =>
    (target: object, propertyKey: string | symbol) => {
      pushClassKey(target, propertyKey);

      const json_schema: NumberSchema = {
        type: 'number',
        title: titleCase(propertyKey.toString()),
        description,
        ...options,
      };

      // Set OpenAI properties
      Reflect.defineMetadata(KEY_PROP_OPTIONS, json_schema, target, propertyKey);
    };

/**
 * A decorator function for creating a `null` property in a class.
 *
 * @param {string} description - The description of the `null` property.
 * @param {PropertyOptions<NullSchema>} [options] - Additional options for the `null` property.
 * @returns {PropertyDecorator} - The property decorator function.
 */
export const AiNull =
  (description: string, options?: PropertyOptions<NullSchema>): PropertyDecorator =>
    (target: object, propertyKey: string | symbol) => {
      pushClassKey(target, propertyKey);

      const json_schema: NullSchema = {
        type: 'null',
        title: titleCase(propertyKey.toString()),
        description,
        ...options,
      };

      // Set OpenAI properties
      Reflect.defineMetadata(KEY_PROP_OPTIONS, json_schema, target, propertyKey);
    };

export const AiFunctionCall =
  (options: OpenAiFunctionOptions): ClassDecorator =>
    (target) => {
      Reflect.defineMetadata(KEY_FUNC_OPTIONS, { name: target.name, ...options }, target);
    };

export const AiBoolean =
  (description: string, options?: PropertyOptions<BooleanSchema>): PropertyDecorator =>
    (target: object, propertyKey: string | symbol) => {
      pushClassKey(target, propertyKey);

      const json_schema: BooleanSchema = {
        type: 'boolean',
        title: titleCase(propertyKey.toString()),
        description,
        ...options,
      };

      // Set OpenAI properties
      Reflect.defineMetadata(KEY_PROP_OPTIONS, json_schema, target, propertyKey);
    };

/**
 * The string type is used for strings of text. It may contain Unicode characters.
 *
 * @param {string} description - The description of the property.
 * @param {PropertyOptions<StringSchema>} options - The options for the property (optional).
 * @returns {PropertyDecorator} A function used to decorate the property.
 */
export const AiString =
  (description: string, options?: PropertyOptions<StringSchema>): PropertyDecorator =>
    (target: object, propertyKey: string | symbol) => {
      pushClassKey(target, propertyKey);

      const json_schema: StringSchema = {
        type: 'string',
        title: titleCase(propertyKey.toString()),
        description,
        ...options,
      };

      // Convert pattern from RegExp to String if needed
      if (json_schema.pattern) {
        json_schema.pattern = String(json_schema.pattern) as unknown as RegExp;
      }

      // Validate min_length and max_length
      if ((json_schema.minLength ?? 0) < 0) {
        throw new Error('The minLength value cannot be less than 0');
      }

      if (json_schema.minLength !== undefined && json_schema.maxLength !== undefined) {
        if (json_schema.minLength >= json_schema.maxLength) {
          throw new Error(
            'The minLength value cannot be greater than or equal to the maxLength value',
          );
        }
      }

      // Set OpenAI properties
      Reflect.defineMetadata(KEY_PROP_OPTIONS, json_schema, target, propertyKey);
    };

/**
 * Objects are the mapping type in JSON. They map "keys" to "values". In JSON, the "keys" must always be strings. Each of these pairs is conventionally referred to as a "property".
 *
 * @param {string} description - The description of the property.
 * @param {PropertyOptions<ObjectSchema>} [options] - The options for the property.
 * @returns {PropertyDecorator} - The decorator function.
 */
export const AiObject =
  (description: string, options?: PropertyOptions<ObjectSchema>): PropertyDecorator =>
    (target: object, propertyKey: string | symbol) => {
      pushClassKey(target, propertyKey);

      const json_schema: ObjectSchema = {
        type: 'object',
        properties: {},
        title: titleCase(propertyKey.toString()),
        description,
        ...options,
      };

      // Get property type
      const designType = Reflect.getMetadata(KEY_DESIGN_TYPE, target, propertyKey);

      // Get class proto keys
      const proto_keys: string[] = Reflect.getMetadata(KEY_CLASS_KEYS, designType.prototype) ?? [];

      // Consolidate properties json_schema
      json_schema.properties = proto_keys.reduce(
        (acc, key) => {
          const prop_schema = Reflect.getMetadata(KEY_PROP_OPTIONS, designType.prototype, key);
          if (prop_schema) {
            acc[key] = prop_schema;
          }
          return acc;
        },
        {} as Record<string, unknown>,
      );

      // Get required feilds from properties (Check if the properties are not marked optional)
      json_schema.required = Object.keys(json_schema.properties).filter(
        (key) => !Reflect.getMetadata(KEY_PROP_OPTIONAL, target, key),
      );

      // Set OpenAI properties
      Reflect.defineMetadata(KEY_PROP_OPTIONS, json_schema, target, propertyKey);
    };

/**
 * A decorator used to mark a property as optional.
 *
 * @param target The target object (class).
 * @param propertyKey The name of the property.
 */
export const AiOptional: PropertyDecorator = (target, propertyKey) => {
  Reflect.defineMetadata(KEY_PROP_OPTIONAL, false, target, propertyKey);
};


/**
 * The string type is used for strings of text. It may contain Unicode characters.
 *
 * @param {string} description - The description of the enum property.
 * @param {Enum<unknown> | unknown[]} enum_type_or_values - The enum type or values.
 * @param {PropertyOptions<StringSchema>} options - Optional property options.
 * @returns {PropertyDecorator} - The property decorator function.
 */
export const AiEnum =
  (
    description: string,
    enum_type_or_values: Enum<unknown> | unknown[],
    options?: PropertyOptions<StringSchema>,
  ): PropertyDecorator =>
    (target: object, propertyKey: string | symbol) => {
      pushClassKey(target, propertyKey);

      const json_schema: GenericSchema<string | number> = {
        title: titleCase(propertyKey.toString()),
        description,
        enum: Array.isArray(enum_type_or_values)
          ? enum_type_or_values
          : Object.values(enum_type_or_values),
        ...options,
      };

      // Set OpenAI properties
      Reflect.defineMetadata(KEY_PROP_OPTIONS, json_schema, target, propertyKey);
    };
