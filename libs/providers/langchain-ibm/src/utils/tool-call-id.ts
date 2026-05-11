/**
 * Utilities for converting tool call IDs to Mistral-compatible format
 * @module utils/tool-call-id
 */

const TOOL_CALL_ID_PATTERN = /^[a-zA-Z0-9]{9}$/;
const BASE62_CHARS =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Checks if a tool call ID is valid for Mistral format (9 alphanumeric characters)
 */
export function _isValidMistralToolCallId(toolCallId: string): boolean {
  return TOOL_CALL_ID_PATTERN.test(toolCallId);
}

/**
 * Encodes a number to base62 string
 * @internal
 */
function _base62Encode(num: number): string {
  let numCopy = num;
  if (numCopy === 0) return BASE62_CHARS[0];
  const arr: string[] = [];
  const base = BASE62_CHARS.length;
  while (numCopy) {
    arr.push(BASE62_CHARS[numCopy % base]);
    numCopy = Math.floor(numCopy / base);
  }
  return arr.reverse().join("");
}

/**
 * Creates a simple hash from a string
 * @internal
 */
function _simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash &= hash;
  }
  return Math.abs(hash);
}

/**
 * Converts a tool call ID to Mistral-compatible format (9 alphanumeric characters).
 * If the ID is already valid, returns it unchanged.
 * Otherwise, creates a hash-based 9-character ID.
 *
 * @param toolCallId - The tool call ID to convert
 * @returns A Mistral-compatible 9-character tool call ID
 *
 * @example
 * ```typescript
 * const id = _convertToolCallIdToMistralCompatible("my-long-tool-call-id-123");
 * // Returns a 9-character alphanumeric string
 * ```
 */
export function _convertToolCallIdToMistralCompatible(
  toolCallId: string,
): string {
  if (_isValidMistralToolCallId(toolCallId)) {
    return toolCallId;
  }

  const hash = _simpleHash(toolCallId);
  const base62Str = _base62Encode(hash);

  if (base62Str.length >= 9) {
    return base62Str.slice(0, 9);
  }

  return base62Str.padStart(9, "0");
}
