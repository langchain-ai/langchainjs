import { expectTypeOf, test } from "vitest";
import type { QdrantLibArgs } from "../index.js";

test("top-level custom payload fields are an optional store setting", () => {
  expectTypeOf<QdrantLibArgs["customPayloadAtTopLevel"]>().toEqualTypeOf<
    boolean | undefined
  >();
});
