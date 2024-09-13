import { Serializable } from "./serializable.js";

export function combineAliasesAndInvert(constructor: typeof Serializable) {
  const aliases: { [key: string]: string } = {};
  for (
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let current = constructor;
    current && current.prototype;
    current = Object.getPrototypeOf(current)
  ) {
    Object.assign(aliases, Reflect.get(current.prototype, "lc_aliases"));
  }
  return Object.entries(aliases).reduce((acc, [key, value]) => {
    acc[value] = key;
    return acc;
  }, {} as Record<string, string>);
}
