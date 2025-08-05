/**
 * Merges two types A and B, with B's properties taking precedence over A's properties.
 * If B is undefined, returns A. If A is undefined, returns B.
 * Otherwise, returns a type that includes all properties from A that don't exist in B,
 * combined with all properties from B.
 *
 * @template A - The first type to merge
 * @template B - The second type to merge, which takes precedence over A
 */
export type $Merge<A, B> = B extends undefined
  ? A
  : A extends undefined
  ? B
  : Omit<A, keyof B> & B;

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
