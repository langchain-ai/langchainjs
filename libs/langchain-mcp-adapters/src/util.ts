// Helper type: Converts a union of types into an intersection of functions,
// each function returning one member of the union.
// For U = A | B, this becomes (() => A) & (() => B)
type UnionToIntersectionFn<U> = (
  U extends unknown ? (k: () => U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

// Helper type: Infers the "last" type from a union.
// It leverages the behavior of TypeScript when inferring from an intersection
// of overloaded function signatures. For instance, if you have (() => A) & (() => B),
// calling this function type would typically resolve to B (the "last" overload).
type GetUnionLast<U> = UnionToIntersectionFn<U> extends () => infer L
  ? L
  : never;

// Helper type: Prepends an element to the beginning of a tuple.
type Prepend<Tuple extends unknown[], First> = [First, ...Tuple];

/**
 * Converts a union of types into a tuple type.
 *
 * For example, `UnionToTuple<"a" | "b" | "c">` becomes `["a", "b", "c"]`.
 */
export type UnionToTuple<
  Union,
  _Result extends unknown[] = [] // Internal accumulator for the tuple elements
> = [Union] extends [never] // Base case: If the Union is empty (never),
  ? _Result // we're done, return the accumulated tuple.
  : UnionToTuple<
      // Recursive step:
      Exclude<Union, GetUnionLast<Union>>, // Process the Union excluding its "last" identified element.
      Prepend<_Result, GetUnionLast<Union>> // Prepend the "last" element to our accumulating tuple.
      // Since elements are prepended, the final order matches
      // the typical resolution order of GetUnionLast.
    >;
