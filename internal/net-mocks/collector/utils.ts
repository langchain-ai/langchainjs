export const iife = <T>(fn: () => T) => fn();

export type PromiseOrValue<T> = T | Promise<T>;

export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Converts a string into a file-safe string by replacing or removing
 * characters that are not safe for filenames on most filesystems.
 * - Replaces spaces and unsafe characters with underscores.
 * - Removes or replaces reserved/special characters.
 * - Trims leading/trailing underscores and dots.
 */
export function toFileSafeString(input: string): string {
  return input
    .normalize("NFKD") // Normalize unicode
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-zA-Z0-9._-]/g, "_") // Replace unsafe chars with _
    .replace(/_+/g, "_") // Collapse multiple underscores
    .replace(/^[_\.]+|[_\.]+$/g, "") // Trim leading/trailing _ or .
    .slice(0, 255); // Limit to 255 chars (common FS limit)
}

/**
 * Performs a deep equality check between two values, with special handling for stringified JSON.
 *
 * If either value is a string that can be parsed as JSON, it will be parsed before comparison.
 * This allows for deep equality checks between objects and their JSON string representations.
 *
 * @param {unknown} a - The first value to compare. Can be any type.
 * @param {unknown} b - The second value to compare. Can be any type.
 * @returns {boolean} True if the values are deeply equal (after normalization), false otherwise.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  const normalize = (value: unknown) => {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value);
    } catch (e) {
      return value;
    }
  };

  return _deepEqual(normalize(a), normalize(b));
}
