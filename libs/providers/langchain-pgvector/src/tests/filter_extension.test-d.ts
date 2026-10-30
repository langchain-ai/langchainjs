import { describe, expectTypeOf, test } from "vitest";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { PGVectorStore } from "../vectorstores.js";
import type { MetadataFilter } from "../vectorstores.js";

/**
 * Type-level tests for the `private` → `protected` change.
 *
 * A transpiled `private` override is not an error at runtime, so the runtime
 * suite cannot catch a regression here. These files only compile if
 * `buildFilterClauses` is `protected`.
 */
class ExtendingStore extends PGVectorStore {
  protected override buildFilterClauses(
    filter: MetadataFilter,
    paramOffset = 0
  ) {
    return super.buildFilterClauses(filter, paramOffset);
  }

  /** Exposes the inherited return type without making the method public. */
  public build(filter: MetadataFilter, paramOffset = 0) {
    return this.buildFilterClauses(filter, paramOffset);
  }
}

describe("buildFilterClauses visibility (types)", () => {
  test("a subclass can override it", () => {
    expectTypeOf<ExtendingStore>().toMatchTypeOf<PGVectorStore>();
  });

  test("it is not reachable on the base class", () => {
    expectTypeOf<PGVectorStore>().not.toHaveProperty("buildFilterClauses");
  });

  test("the override can delegate to the base implementation", () => {
    // Compiling the override above is the assertion; this pins the inherited
    // return shape so a signature change breaks the type tests.
    const store = new ExtendingStore({} as EmbeddingsInterface, {
      tableName: "t",
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      pool: {} as any,
    });
    expectTypeOf(store.build({})).toEqualTypeOf<{
      whereClauses: string[];
      parameters: unknown[];
      paramCount: number;
    }>();
  });
});
