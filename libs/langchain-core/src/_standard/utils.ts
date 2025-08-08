/**
 * Expands a type into a single object by recursively expanding all its properties.
 *
 * For primitive types (string, number, boolean, bigint, symbol, null, undefined),
 * the type is returned as-is. For object types, all properties are expanded to
 * show their actual structure rather than lazy type aliases.
 *
 * This utility is particularly useful for making TypeScript display the full
 * structure of complex types in IDE tooltips and error messages, rather than
 * showing abbreviated type names.
 *
 * @template T - The type to expand
 *
 * @example
 * type MyType = { a: string } & { b: number };
 * type Expanded = $Expand<MyType>; // { a: string; b: number }
 *
 * type PrimitiveExpanded = $Expand<string>; // string (unchanged)
 */
export type $Expand<T> = T extends Primitive
  ? T
  : { [K in keyof T]: $Expand<T[K]> };

/**
 * Merges two array types T and U into a single array type.
 *
 * The merge behavior handles the following cases:
 * - If T is never: Returns an array with elements merged from T and U
 * - If U is never: Returns an array with elements merged from T and U
 * - If both T and U are valid array types: Performs deep merging of element types
 *
 * This type properly handles union types by distributing over each member of the union.
 * The resulting array contains elements that are the merged type of T's and U's element types.
 *
 * @template T - The first array type to merge, must extend readonly any[]
 * @template U - The second array type to merge, must extend readonly any[]
 *
 * @example
 * type Result1 = $MergeArrays<string[], number[]>; // (string | number)[]
 * type Result2 = $MergeArrays<{ a: string }[], { b: number }[]>; // { a: string; b: number }[]
 * type Result3 = $MergeArrays<never, string[]>; // string[]
 */
export type $MergeArrays<T extends readonly any[], U extends readonly any[]> = [
  T
] extends [never]
  ? U extends any
    ? MergeNonUnionArrays<T, U>
    : never
  : [U] extends [never]
  ? T extends any
    ? MergeNonUnionArrays<T, U>
    : never
  : T extends any
  ? U extends any
    ? MergeNonUnionArrays<T, U>
    : never
  : never;

/**
 * Merges two object types T and U into a single object type.
 *
 * The merge behavior handles the following cases:
 * - If T is never: Returns U with all properties made optional and undefined excluded
 * - If U is never: Returns T with all properties made optional and undefined excluded
 * - If both T and U are valid types: Performs deep merging
 *
 * This type properly handles union types by distributing over each member of the union.
 *
 * @template T - The first object type to merge
 * @template U - The second object type to merge
 *
 * @example
 * type Result1 = $MergeObjects<{ a: string }, { b: number }>; // { a: string; b: number }
 * type Result2 = $MergeObjects<never, { a: string }>; // { a?: string }
 * type Result3 = $MergeObjects<{ a: string }, never>; // { a?: string }
 */
export type $MergeObjects<T, U> = [T] extends [never]
  ? U extends any
    ? { [K in keyof U]?: Exclude<U[K], undefined> }
    : never
  : [U] extends [never]
  ? T extends any
    ? { [K in keyof T]?: Exclude<T[K], undefined> }
    : never
  : T extends any
  ? U extends any
    ? MergeNonUnionObjects<T, U>
    : never
  : never;

/**
 * Merges two types T and U into a single type.
 *
 * The merge behavior depends on the types being merged:
 * - For primitive types: Returns a union of the primitives from both T and U
 * - For arrays: Merges array types using $MergeArrays, combining element types
 * - For objects: Merges object types using $MergeObjects, combining properties
 *
 * @template T - The first type to merge
 * @template U - The second type to merge
 *
 * @example
 * type Result1 = $Merge<{ a: string }, { b: number }>; // { a: string; b: number }
 * type Result2 = $Merge<string[], number[]>; // (string | number)[]
 * type Result3 = $Merge<string, number>; // string | number
 */
export type $Merge<T, U> =
  | Extract<T | U, Primitive>
  | $MergeArrays<Extract<T, readonly any[]>, Extract<U, readonly any[]>>
  | $MergeObjects<
      Exclude<T, Primitive | readonly any[]>,
      Exclude<U, Primitive | readonly any[]>
    >;

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

type Primitive = string | number | boolean | bigint | symbol | null | undefined;

type OptionalKeys<T> = {
  [K in keyof T]-?: T extends Record<K, T[K]> ? never : K;
}[keyof T];

type OptionalMergeKeys<T, U> = Extract<OptionalKeys<T>, PropertyKey> &
  Extract<OptionalKeys<U>, PropertyKey>;
type RequiredMergeKeys<T, U> = Extract<
  Exclude<keyof T | keyof U, OptionalMergeKeys<T, U>>,
  PropertyKey
>;

type MergedValueAtKey<T, U, K extends PropertyKey> = K extends keyof T
  ? K extends keyof U
    ? $Expand<$Merge<Exclude<T[K], undefined>, Exclude<U[K], undefined>>>
    : Exclude<T[K], undefined>
  : K extends keyof U
  ? Exclude<U[K], undefined>
  : never;

type MergeNonUnionObjects<T, U> = $Expand<
  {
    [K in RequiredMergeKeys<T, U>]-?: MergedValueAtKey<T, U, K>;
  } & {
    [K in OptionalMergeKeys<T, U>]?: MergedValueAtKey<T, U, K>;
  }
>;

type MergeNonUnionArrays<
  T extends readonly any[],
  U extends readonly any[]
> = Array<$Expand<$Merge<T[number], U[number]>>>;
