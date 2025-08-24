import { describe, it, expectTypeOf } from "vitest";
import { type $MergeObjects, type $MergeDiscriminatedUnion } from "../utils.js";

describe("$MergeObjects", () => {
  it("should merge non-overlapping keys from T and U into the result type", async () => {
    type T = { a: string };
    type U = { b: number };
    type R = $MergeObjects<T, U>;
    expectTypeOf<R>().toEqualTypeOf<{ a: string; b: number }>();
  });

  it("should use U's value when both T and U define a non-object value for the same key", async () => {
    type T = { v: string };
    type U = { v: number };
    type R = $MergeObjects<T, U>;
    expectTypeOf<R>().toEqualTypeOf<{ v: number }>();
  });

  it("should recursively merge nested records when both T[K] and U[K] extend Record<string, unknown>", async () => {
    type T = { cfg: { a: string; b: number } };
    type U = { cfg: { b: string; c: Date } };
    type R = $MergeObjects<T, U>;
    expectTypeOf<R>().toEqualTypeOf<{
      cfg: { a: string; b: string; c: Date };
    }>();
  });

  it("should prefer U[K] when T[K] extends Record<string, unknown> but U[K] does not", async () => {
    type T = Record<string, unknown>;
    type U = { x: boolean };
    type R = $MergeObjects<T, U>;
    expectTypeOf<R>().toEqualTypeOf<{ x: boolean }>();
  });

  it("should prefer U[K] when U[K] extends Record<string, unknown> but T[K] does not", async () => {
    type T = { x: string };
    type U = Record<string, unknown>;
    type R = $MergeObjects<T, U>;
    expectTypeOf<R>().toEqualTypeOf<Record<string, unknown>>();
  });

  it("should include keys that exist only in T with their original types", async () => {
    type T = { onlyT: number };
    type U = object;
    type R = $MergeObjects<T, U>;
    expectTypeOf<R>().toEqualTypeOf<{ onlyT: number }>();
  });

  it("should include keys that exist only in U with their original types", async () => {
    type T = object;
    type U = { onlyU: number };
    type R = $MergeObjects<T, U>;
    expectTypeOf<R>().toEqualTypeOf<{ onlyU: number }>();
  });

  it("should deep-merge multiple nesting levels (3+ levels) when both sides have nested records", async () => {
    type T = { a: { b: { c: { x: number; y: number } } } };
    type U = { a: { b: { c: { y: string; z: boolean } } } };
    type R = $MergeObjects<T, U>;
    expectTypeOf<R>().toEqualTypeOf<{
      a: { b: { c: { x: number; y: string; z: boolean } } };
    }>();
  });

  it("should treat arrays as non-mergeable (since not Record<string, unknown>) and prefer U's array type over T's", async () => {
    type T = { arr: string[] };
    type U = { arr: number[] };
    type R = $MergeObjects<T, U>;
    expectTypeOf<R>().toEqualTypeOf<{ arr: number[] }>();
  });

  it("should be idempotent with empty U (M<T, {}> yields T)", async () => {
    type T = { a: string; b: { c: number } };
    type R = $MergeObjects<T, object>;
    expectTypeOf<R>().toEqualTypeOf<{ a: string; b: { c: number } }>();
  });

  it("should be idempotent with empty T (M<{}, U> yields U)", async () => {
    type U = { a: string; b: { c: number } };
    type R = $MergeObjects<object, U>;
    expectTypeOf<R>().toEqualTypeOf<U>();
  });

  it("should not be commutative (M<T, U> differs from M<U, T> when overlapping keys exist)", async () => {
    type T = { x: { a: number } };
    type U = { x: boolean };
    type R1 = $MergeObjects<T, U>;
    type R2 = $MergeObjects<U, T>;
    expectTypeOf<R1>().toEqualTypeOf<{ x: boolean }>();
    expectTypeOf<R2>().toEqualTypeOf<{ x: { a: number } }>();
  });

  it("should support symbol and number keys in mapped types without loss", async () => {
    const SYM = Symbol("SYM");
    type T = { [SYM]: { a: 1 }; 42: string };
    type U = { [SYM]: boolean; 42: number };
    type R = $MergeObjects<T, U>;
    expectTypeOf<R[typeof SYM]>().toEqualTypeOf<boolean>();
    expectTypeOf<R[42]>().toEqualTypeOf<number>();
  });
});

describe("$MergeDiscriminatedUnion", () => {
  it("should include all discriminator members present in A when not overridden by B", async () => {
    type A = { type: "a"; a: 1 } | { type: "b"; b: 2 } | { type: 1; n: "one" };
    type B = { type: "b"; b: "B"; extra: string } | { type: "c"; c: true };
    type R = $MergeDiscriminatedUnion<A, B>;
    // 'a' and numeric 1 only in A should be present
    expectTypeOf<Extract<R, { type: "a" }>>().toEqualTypeOf<{
      type: "a";
      a: 1;
    }>();
    expectTypeOf<Extract<R, { type: 1 }>>().toEqualTypeOf<{
      type: 1;
      n: "one";
    }>();
    expectTypeOf<R>().toEqualTypeOf<
      | { type: "a"; a: 1 }
      | { type: "b"; b: "B"; extra: string }
      | { type: "c"; c: true }
      | { type: 1; n: "one" }
    >();
  });

  it("should include all discriminator members present in B, overriding members from A with the same discriminator value", async () => {
    type A = { type: "b"; b: 2 };
    type B = { type: "b"; b: "B"; extra: string };
    type R = $MergeDiscriminatedUnion<A, B>;
    expectTypeOf<R>().toEqualTypeOf<{ type: "b"; b: "B"; extra: string }>();
  });

  it("should include members only present in B (new discriminator values) in the result", async () => {
    type A = { type: "a"; a: 1 };
    type B = { type: "c"; c: true };
    type R = $MergeDiscriminatedUnion<A, B>;
    expectTypeOf<R>().toEqualTypeOf<
      { type: "a"; a: 1 } | { type: "c"; c: true }
    >();
  });

  it("should include members only present in A (missing from B) in the result", async () => {
    type A = { type: "a"; a: 1 };
    type B = { type: "b"; b: 2 };
    type R = $MergeDiscriminatedUnion<A, B>;
    expectTypeOf<R>().toEqualTypeOf<
      { type: "a"; a: 1 } | { type: "b"; b: 2 }
    >();
  });

  it("should accept a custom discriminator key via the third type parameter (e.g., 'kind')", async () => {
    type A = { kind: "x"; ax: number } | { kind: "y"; ay: string };
    type B = { kind: "y"; by: boolean } | { kind: "z"; bz: Date };
    type R = $MergeDiscriminatedUnion<A, B, "kind">;
    type Expected =
      | { kind: "x"; ax: number }
      | { kind: "y"; ay: string; by: boolean }
      | { kind: "z"; bz: Date };
    expectTypeOf<R>().toEqualTypeOf<Expected>();
  });

  it("should support string, number, and symbol discriminator values", async () => {
    const S1 = Symbol("S1");
    const S2 = Symbol("S2");
    type A =
      | { type: "a"; a: 1 }
      | { type: 1; n: "one" }
      | { type: typeof S1; s1: true };
    type B = { type: "b"; b: 2 } | { type: typeof S2; s2: false };
    type R = $MergeDiscriminatedUnion<A, B>;
    expectTypeOf<Extract<R, { type: "a" }>>().toEqualTypeOf<{
      type: "a";
      a: 1;
    }>();
    expectTypeOf<Extract<R, { type: 1 }>>().toEqualTypeOf<{
      type: 1;
      n: "one";
    }>();
    expectTypeOf<Extract<R, { type: typeof S1 }>>().toEqualTypeOf<{
      type: typeof S1;
      s1: true;
    }>();
    expectTypeOf<Extract<R, { type: typeof S2 }>>().toEqualTypeOf<{
      type: typeof S2;
      s2: false;
    }>();
    expectTypeOf<R>().toEqualTypeOf<
      | { type: "a"; a: 1 }
      | { type: "b"; b: 2 }
      | { type: 1; n: "one" }
      | { type: typeof S1; s1: true }
      | { type: typeof S2; s2: false }
    >();
  });
});
