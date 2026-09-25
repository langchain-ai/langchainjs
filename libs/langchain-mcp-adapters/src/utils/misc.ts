export const iife = <T>(fn: () => T): T => fn();

/**
 * A utility function that serializes the headers object to a string
 * and orders the keys alphabetically so that the same headers object
 * will always produce the same string.
 * @param headers - The headers object to serialize
 * @returns The serialized headers object
 */
export function serializeHeaders(
  headers?: Record<string, string>
): string | undefined {
  if (!headers || Object.keys(headers).length === 0) {
    return;
  }

  return JSON.stringify([...new Headers(headers)]);
}

/**
 * Merge header sets; later sources win.
 *
 * `Headers` deduplicates case-insensitively and lower-cases names. The SDK
 * (>= 2.1.0) compares names case-insensitively when it adds its own headers,
 * so the spelling here no longer matters downstream.
 */
export function mergeHeaders(
  base: Record<string, string> | undefined,
  overrides: Record<string, string> | undefined
): Record<string, string> {
  const headers = new Headers(base);

  for (const [name, value] of Object.entries(overrides ?? {}))
    headers.set(name, value);

  return Object.fromEntries(headers);
}
