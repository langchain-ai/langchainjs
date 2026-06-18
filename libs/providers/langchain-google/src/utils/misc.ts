/**
 * Immediately invokes the provided function and returns its result.
 */
export const iife = <T>(fn: () => T): T => fn();

/**
 * Type utility that recursively resolves object shape, removing type aliases,
 * intersections, and unions for easier type introspection and error output.
 *
 * Usage:
 *   type Input = { a: string } & { b: number };
 *   type Output = Prettify<Input>; // { a: string; b: number }
 */
export type Prettify<T> = T extends object
  ? { [K in keyof T]: Prettify<T[K]> }
  : T;

/**
 * Distributes over a string union and applies Lowercase only to
 * string-literal members, filtering out wide `string` / `string & {}`.
 */
export type LowercaseLiteral<T> = T extends string
  ? string extends T
    ? never
    : Lowercase<T>
  : never;
