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
  if (typeof value === "number") {
    return value % 1 === 0;
  } else if (typeof value === "string") {
    const numberValue = parseInt(value, 10);
    return (
      !Number.isNaN(numberValue) &&
      numberValue % 1 === 0 &&
      numberValue.toString() === value
    );
  }

  return false;
}

/**
 * Checks if the provided value is a floating-point number.
 */
export function isFloat(value: unknown): boolean {
  if (typeof value === "number") {
    return value % 1 !== 0;
  } else if (typeof value === "string") {
    const numberValue = parseFloat(value);
    return (
      !Number.isNaN(numberValue) &&
      numberValue % 1 !== 0 &&
      numberValue.toString() === value
    );
  }

  return false;
}

/**
 * Checks if the provided value is a string that cannot be parsed into a
 * number.
 */
export function isString(value: unknown): boolean {
  return (
    typeof value === "string" &&
    (Number.isNaN(parseFloat(value)) || parseFloat(value).toString() !== value)
  );
}

/**
 * Casts a value that might be string or number to actual string or number.
 * Since LLM might return back an integer/float as a string, we need to cast
 * it back to a number, as many vector databases can't handle number as string
 * values as a comparator.
 */
export function castValue(input: unknown): string | number {
  let value;
  if (isString(input)) {
    value = input as string;
  } else if (isInt(input)) {
    value = parseInt(input as string, 10);
  } else if (isFloat(input)) {
    value = parseFloat(input as string);
  } else {
    throw new Error("Unsupported value type");
  }

  return value;
}
