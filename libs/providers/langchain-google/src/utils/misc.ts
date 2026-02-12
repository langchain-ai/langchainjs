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
