// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isObject(obj: any): obj is object {
  return obj && typeof obj === "object" && !Array.isArray(obj);
}

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

export function isInt(value: unknown): boolean {
  const numberValue = parseFloat(value as string);
  return !Number.isNaN(numberValue) && numberValue % 1 === 0;
}

export function isFloat(value: unknown): boolean {
  const numberValue = parseFloat(value as string);
  return !Number.isNaN(numberValue) && numberValue % 1 !== 0;
}

export function isString(value: unknown): boolean {
  return typeof value === "string" && Number.isNaN(parseFloat(value as string));
}
