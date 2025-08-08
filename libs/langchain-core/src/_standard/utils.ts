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
export type $MergeObjects<T, U> = {
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
    : // If B does have this discriminator value, use B's member (B takes precedence)
      Extract<B, Record<Key, T>>;
  // Index into the mapped type with all possible discriminator values
  // This converts the mapped type back into a union
}[A[Key] | B[Key]];

/**
 * Converts a union of types into an intersection of those types.
 *
 * @template U - The union type to convert.
 * @example
 * type T = UnionToIntersection<{ a: string } | { b: number }>;
 * // T is { a: string } & { b: number }
 */
export type $UnionToIntersection<U> = (
  U extends any ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

/**
 * Picks a subset of a union type where the union returned matches up with keys
 * that are passed into the second type argument, and merges them into a single type.
 *
 * @template TUnion - The union type to filter
 * @template TKeys - The keys to filter by
 */
export type $PickUnion<TUnion, TKeys> = $UnionToIntersection<
  TUnion extends TKeys ? TUnion : never
>;
