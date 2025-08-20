/**
 * Extracts the explicitly declared keys from a type T.
 *
 * @template T - The type to extract keys from
 * @returns A union of keys that are not string, number, or symbol
 */
type $KnownKeys<T> = {
  [K in keyof T]: string extends K
    ? never
    : number extends K
    ? never
    : symbol extends K
    ? never
    : K;
}[keyof T];

/**
 * Detects if T has an index signature.
 *
 * @template T - The type to check for index signatures
 * @returns True if T has an index signature, false otherwise
 */
type $HasIndexSignature<T> = string extends keyof T
  ? true
  : number extends keyof T
  ? true
  : symbol extends keyof T
  ? true
  : false;

/**
 * Detects if T has an index signature and no known keys.
 *
 * @template T - The type to check for index signatures and no known keys
 * @returns True if T has an index signature and no known keys, false otherwise
 */
type $OnlyIndexSignatures<T> = $HasIndexSignature<T> extends true
  ? [$KnownKeys<T>] extends [never]
    ? true
    : false
  : false;

/**
 * Recursively merges two object types T and U, with U taking precedence over T.
 *
 * This utility type performs a deep merge of two object types:
 * - For keys that exist in both T and U:
 *   - If both values are objects (Record<string, unknown>), recursively merge them
 *   - Otherwise, U's value takes precedence
 * - For keys that exist only in T, use T's value
 * - For keys that exist only in U, use U's value
 *
 * @template T - The first object type to merge
 * @template U - The second object type to merge (takes precedence over T)
 *
 * @example
 * ```ts
 * type ObjectA = {
 *   shared: { a: string; b: number };
 *   onlyInA: boolean;
 * };
 *
 * type ObjectB = {
 *   shared: { b: string; c: Date };
 *   onlyInB: symbol;
 * };
 *
 * type Merged = $MergeObjects<ObjectA, ObjectB>;
 * // Result: {
 * //   shared: { a: string; b: string; c: Date };
 * //   onlyInA: boolean;
 * //   onlyInB: symbol;
 * // }
 * ```
 */
export type $MergeObjects<T, U> =
  // If U is purely index-signature based, prefer U as a whole
  $OnlyIndexSignatures<U> extends true
    ? U
    : // If T is purely index-signature based, prefer U as a whole (prevents leaking broad index signatures)
    $OnlyIndexSignatures<T> extends true
    ? U
    : {
        [K in keyof T | keyof U]: K extends keyof T
          ? K extends keyof U
            ? T[K] extends Record<string, unknown>
              ? U[K] extends Record<string, unknown>
                ? $MergeObjects<T[K], U[K]>
                : U[K]
              : U[K]
            : T[K]
          : K extends keyof U
          ? U[K]
          : never;
      };

/**
 * Merges two discriminated unions A and B based on a discriminator key (defaults to "type").
 * For each possible value of the discriminator across both unions:
 * - If B has a member with that discriminator value, use B's member
 * - Otherwise use A's member with that discriminator value
 * This effectively merges the unions while giving B's members precedence over A's members.
 *
 * @template A - First discriminated union type that extends Record<Key, PropertyKey>
 * @template B - Second discriminated union type that extends Record<Key, PropertyKey>
 * @template Key - The discriminator key property, defaults to "type"
 */
export type $MergeDiscriminatedUnion<
  A extends Record<Key, PropertyKey>,
  B extends Record<Key, PropertyKey>,
  Key extends PropertyKey = "type"
> = {
  // Create a mapped type over all possible discriminator values from both A and B
  [T in A[Key] | B[Key]]: [Extract<B, Record<Key, T>>] extends [never] // Check if B has a member with this discriminator value
    ? // If B doesn't have this discriminator value, use A's member
      Extract<A, Record<Key, T>>
    : // If B does have this discriminator value, merge A's and B's members (B takes precedence)
    [Extract<A, Record<Key, T>>] extends [never]
    ? Extract<B, Record<Key, T>>
    : $MergeObjects<Extract<A, Record<Key, T>>, Extract<B, Record<Key, T>>>;
  // Index into the mapped type with all possible discriminator values
  // This converts the mapped type back into a union
}[A[Key] | B[Key]];

/**
 * Immediately-invoked function expression.
 *
 * @param fn - The function to execute
 * @returns The result of the function
 */
export const iife = <T>(fn: () => T) => fn();
