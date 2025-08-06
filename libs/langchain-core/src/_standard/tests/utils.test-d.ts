// : $Merge
// :: should merge two object types, with the second type's properties overwriting the first's
// ::: should combine properties from both types when there is no overlap
// ::: should overwrite properties of A with properties of B when there is overlap
// ::: should handle cases where B has properties that A does not
// ::: should handle cases where A has properties that B does not
// :: should handle undefined
// ::: should return A if B is undefined
// ::: should return B if A is undefined
// :: should handle `any` and `never`
// ::: should result in `any` if either A or B is `any`
// ::: should ignore `never` type, treating it as an empty object
// :: should handle non-object types
// ::: should correctly merge primitive types, with B taking precedence (e.g., $Merge<string, number> should be number)
// ::: should handle intersections and unions
// :: should handle complex nested objects
// ::: should perform a shallow merge on nested objects, with B's nested object overwriting A's

// : $MergeDiscriminatedUnion
// :: should merge two discriminated unions with a default key 'type'
// ::: should use B's member when discriminator value exists in both A and B
// ::: should use A's member when discriminator value only exists in A
// ::: should use B's member when discriminator value only exists in B
// ::: should result in a union containing all unique discriminated members
// :: should merge two discriminated unions with a custom key
// ::: should correctly merge unions based on a specified custom key
// :: should handle empty or `never` unions
// ::: should return B if A is `never`
// ::: should return A if B is `never`
// :: should handle unions with no overlapping discriminators
// ::: should produce a new union of all members from both A and B
// :: should handle unions with fully overlapping discriminators
// ::: should produce a union that is identical to B

// : $UnionToIntersection
// :: should convert a union of object types to an intersection
// ::: should convert a union of two object types
// ::: should convert a union of multiple object types
// :: should handle unions with primitive types
// ::: should result in `never` for a union of unrelated primitive types (e.g., string | number)
// :: should handle `any`, `unknown`, and `never`
// ::: should resolve to `any` if `any` is in the union
// ::: should resolve to `unknown` if `unknown` is in the union (and not `any`)
// ::: should resolve to `never` if the union is `never`
// :: should handle a single type in the union
// ::: should return the type itself if it's not a union

// : $PickUnion<TUnion, TMatcher>
// :: should filter a union type based on a matcher type
// ::: should pick members of the union that are assignable to the matcher type
// ::: should return a single type if only one member matches
// ::: should return an intersection of types if multiple members match
// :: should handle non-matching cases
// ::: should result in `never` if no members of the union are assignable to the matcher
// :: should handle matcher type `any` and `unknown`
// ::: should pick all members if the matcher is `any` or `unknown`, and return their intersection
// :: should handle matcher type `never`
// ::: should result in `never` if the matcher is `never` (unless `never` is in the union)
// :: should work with primitive type unions
// ::: should correctly filter a union of primitives (e.g., `string | number`, with matcher `string`)
// :: should work with object unions
// ::: should correctly filter a union of objects based on shape
