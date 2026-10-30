/**
 * Immediately invokes the provided function and returns its result.
 */
export const iife = <T>(fn: () => T): T => fn();

/**
 * Returns a signal that aborts when `signal` aborts or `timeout` ms elapse,
 * whichever is first. A missing or `0` timeout leaves `signal` unchanged.
 */
export function withTimeoutSignal(
  signal: AbortSignal | undefined,
  timeout: number | undefined
): AbortSignal | undefined {
  if (!timeout) {
    return signal;
  }
  const timeoutSignal = AbortSignal.timeout(timeout);
  return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
}

/**
 * Type utility that recursively resolves object shape, removing type aliases,
 * intersections, and unions for easier type introspection and error output.
 * Makes sure to guard primitive types.
 *
 * Usage:
 *   type Input = { a: string } & { b: number };
 *   type Output = Prettify<Input>; // { a: string; b: number }
 */
export type Prettify<T> = T extends Function
  ? T
  : T extends string | number | boolean | bigint | symbol
    ? T
    : T extends object
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
