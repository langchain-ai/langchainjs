/**
 * Normalizes various header formats into a plain object with string keys and string, undefined, or null values.
 *
 * Accepts:
 * - A Headers object (Web API)
 * - An array of [key, value] pairs
 * - A plain object (Record<string, string | undefined | null>)
 *
 * @param headers - The headers to normalize. Can be a Headers object, array of [key, value] pairs, or a plain object.
 * @returns A normalized object with header names as keys and their values as string, undefined, or null.
 */
export function normalizeHeaders(
  headers: unknown
): Record<string, string | undefined | null> {
  if (!headers || typeof headers !== "object") {
    return {};
  }

  // Handle Headers object (Web API)
  if ("get" in headers && typeof headers.get === "function") {
    const headersObject = headers as Headers;
    return Object.fromEntries(headersObject.entries());
  }

  // Handle array format [[key, value], ...]
  if (Array.isArray(headers)) {
    return headers.reduce((acc, [key, value]) => {
      if (key && typeof key === "string") {
        acc[key] = value as string | undefined | null;
      }
      return acc;
    }, {});
  }

  // Handle Record format
  if (typeof headers === "object") {
    const headerRecord = headers as Record<string, string | undefined | null>;
    return { ...headerRecord };
  }
  return {};
}
