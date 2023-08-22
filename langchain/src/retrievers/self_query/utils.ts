/**
 * Checks if the provided argument is an object and not an array.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isObject(obj: any): obj is object {
  return obj && typeof obj === "object" && !Array.isArray(obj);
}

/**
 * Checks if a provided filter is empty. The filter can be a function, an
 * object, a string, or undefined.
 */
export function isFilterEmpty(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter: ((q: any) => any) | object | string | undefined
): filter is undefined {
  if (!filter) return true;
  // for Milvus
  if (typeof filter === "string" && filter.length > 0) {
    return false;
  }
  if (typeof filter === "function") {
    return false;
  }
  return isObject(filter) && Object.keys(filter).length === 0;
}

/**
 * Checks if the provided value is an integer.
 */
export function isInt(value: unknown): boolean {
  const numberValue = parseFloat(value as string);
  return !Number.isNaN(numberValue) && numberValue % 1 === 0;
}

/**
 * Checks if the provided value is a floating-point number.
 */
export function isFloat(value: unknown): boolean {
  const numberValue = parseFloat(value as string);
  return !Number.isNaN(numberValue) && numberValue % 1 !== 0;
}

/**
 * Checks if the provided value is a string that cannot be parsed into a
 * number.
 */
export function isString(value: unknown): boolean {
  return typeof value === "string" && Number.isNaN(parseFloat(value as string));
}
