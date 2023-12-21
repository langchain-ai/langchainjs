import snakeCase from "decamelize";
import camelCase from "camelcase";

export interface SerializedFields {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface SerializedKeyAlias {
  [key: string]: string;
}

export function keyToJson(key: string, map?: SerializedKeyAlias): string {
  return map?.[key] || snakeCase(key);
}

export function keyFromJson(key: string, map?: SerializedKeyAlias): string {
  return map?.[key] || camelCase(key);
}

export function mapKeys(
  fields: SerializedFields,
  mapper: typeof keyToJson,
  map?: SerializedKeyAlias
): SerializedFields {
  const mapped: SerializedFields = {};

  for (const key in fields) {
    if (Object.hasOwn(fields, key)) {
      mapped[mapper(key, map)] = fields[key];
    }
  }

  return mapped;
}
