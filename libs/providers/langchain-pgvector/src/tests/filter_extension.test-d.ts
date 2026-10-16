import { describe, expectTypeOf, test } from "vitest";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { PGVectorStore } from "../vectorstores.js";
import type { MetadataFilter } from "../vectorstores.js";

class StubEmbeddings implements EmbeddingsInterface {
  async embedQuery(): Promise<number[]> {
    return [0.1, 0.2, 0.3];
  }
  async embedDocuments(): Promise<number[][]> {
    return [[0.1, 0.2, 0.3]];
  }
}

/**
 * These are type-level tests. Vitest's `typecheck` pass only covers
 * `*.test-d.ts`, so without this file nothing would fail if
 * `buildFilterClauses` were reverted to `private`: the runtime tests would
 * still pass, because a transpiled `private` override is not an error at
 * runtime. The mere fact that the subclasses below compile is the assertion.
 */
class JsonbStore extends PGVectorStore {
  protected override buildFilterClauses(
    filter: MetadataFilter,
    paramOffset = 0
  ): { whereClauses: string[]; parameters: unknown[]; paramCount: number } {
    const whereClauses: string[] = [];
    const parameters: unknown[] = [];
    let paramCount = paramOffset;

    const remaining: MetadataFilter = {};
    for (const [key, value] of Object.entries(filter)) {
      if (
        typeof value !== "object" ||
        value === null ||
        !("jsonbContains" in (value as Record<string, unknown>))
      ) {
        remaining[key] = value;
        continue;
      }
      const { jsonbContains, ...rest } = value as Record<string, unknown>;
      paramCount += 1;
      parameters.push(key);
      const keyPlaceholder = `$${paramCount}`;
      paramCount += 1;
      parameters.push(JSON.stringify(jsonbContains));
      whereClauses.push(
        `(${this.metadataColumnName} -> ${keyPlaceholder}) @> $${paramCount}::jsonb`
      );
      if (Object.keys(rest).length > 0) {
        remaining[key] = rest;
      }
    }

    const base = super.buildFilterClauses(remaining, paramCount);
    return {
      whereClauses: [...whereClauses, ...base.whereClauses],
      parameters: [...parameters, ...base.parameters],
      paramCount: base.paramCount,
    };
  }

  /**
   * `buildFilterClauses` is `protected`, so it is not callable from outside the
   * class. This re-exposes it so the type tests can assert the signature an
   * override has to match.
   */
  public callBuilder(filter: MetadataFilter, paramOffset = 0) {
    return this.buildFilterClauses(filter, paramOffset);
  }
}

describe("buildFilterClauses is an extension point (types)", () => {
  test("a subclass can override the filter builder", () => {
    // Compiling this class is the assertion: `buildFilterClauses` must be
    // `protected` for the override above to be legal.
    expectTypeOf(JsonbStore.prototype).toExtend<PGVectorStore>();
    expectTypeOf<JsonbStore>().toMatchTypeOf<PGVectorStore>();
  });

  test("the override signature accepts a filter and a parameter offset", () => {
    const store = new JsonbStore(new StubEmbeddings(), {
      tableName: "t",
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      pool: {} as any,
    });
    // `protected` means unreachable from outside the class, so the assertion
    // goes through the re-exposed wrapper rather than the method directly.
    expectTypeOf(store.callBuilder).toBeCallableWith({ a: 1 });
    expectTypeOf(store.callBuilder).toBeCallableWith({ a: 1 }, 2);
  });

  test("the builder returns clauses, parameters and a parameter count", () => {
    const store = new JsonbStore(new StubEmbeddings(), {
      tableName: "t",
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      pool: {} as any,
    });
    expectTypeOf(store.callBuilder({})).toEqualTypeOf<{
      whereClauses: string[];
      parameters: unknown[];
      paramCount: number;
    }>();
  });
});
