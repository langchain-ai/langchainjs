const SAFE_FIELD_NAME_REGEX = /^[a-zA-Z0-9_.-]+$/;

const REDISEARCH_SPECIAL_CHARS = new Set([
  ",",
  ".",
  "<",
  ">",
  "{",
  "}",
  "[",
  "]",
  '"',
  "'",
  ":",
  ";",
  "!",
  "@",
  "#",
  "$",
  "%",
  "^",
  "&",
  "*",
  "(",
  ")",
  "-",
  "+",
  "=",
  "~",
  "\\",
  "|",
  "?",
]);

function shouldEscapeChar(
  char: string,
  options?: { preserveWildcard?: boolean; preserveWhitespace?: boolean }
): boolean {
  if (options?.preserveWhitespace && /\s/.test(char)) {
    return false;
  }
  if (options?.preserveWildcard && (char === "*" || char === "?")) {
    return false;
  }
  if (/\s/.test(char)) {
    return true;
  }
  return REDISEARCH_SPECIAL_CHARS.has(char);
}

export function assertSafeRedisearchFieldName(fieldName: string): void {
  if (!SAFE_FIELD_NAME_REGEX.test(fieldName)) {
    throw new Error(`Unsafe field name: ${fieldName}`);
  }
}

export function escapeRedisearchValue(
  value: string,
  options?: { preserveWildcard?: boolean; preserveWhitespace?: boolean }
): string {
  let escaped = "";

  for (const char of value) {
    if (shouldEscapeChar(char, options)) {
      escaped += `\\${char}`;
    } else {
      escaped += char;
    }
  }

  return escaped;
}
