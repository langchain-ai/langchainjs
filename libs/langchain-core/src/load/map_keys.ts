const UPPER_TO_WORD_BOUNDARY = /([A-Z]+)([A-Z][a-z0-9]+)/g;
const LOWER_TO_UPPER_BOUNDARY = /([a-z0-9])([A-Z])/g;
const SEPARATORS = /[-_\s]+/g;

function snakeCase(key: string): string {
  return key
    .replace(UPPER_TO_WORD_BOUNDARY, "$1_$2")
    .replace(LOWER_TO_UPPER_BOUNDARY, "$1_$2")
    .replace(SEPARATORS, "_")
    .toLowerCase();
}

function camelCase(key: string): string {
  const trimmed = key.trim();
  if (!/[-_\s]/.test(trimmed)) {
    return trimmed;
  }
  return trimmed
    .replace(SEPARATORS, "_")
    .toLowerCase()
    .replace(/_+([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

export interface SerializedFields {
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
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
