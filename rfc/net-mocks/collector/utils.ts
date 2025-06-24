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
