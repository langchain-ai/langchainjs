import { describe, test, expectTypeOf } from "vitest";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import {
  PGVectorStore,
  type FilterClausesResult,
  type MetadataFilter,
  type PGVectorStoreArgs,
} from "../index.js";

describe("PGVectorStore type tests", () => {
  test("allows subclass to override protected buildFilterClauses", () => {
    class SubclassPGVectorStore extends PGVectorStore {
      protected override buildFilterClauses(
        filter: MetadataFilter,
        paramOffset?: number,
      ): FilterClausesResult {
        const base = super.buildFilterClauses(filter, paramOffset);
        expectTypeOf(base).toEqualTypeOf<FilterClausesResult>();
        expectTypeOf(base.whereClauses).toEqualTypeOf<string[]>();
        expectTypeOf(base.parameters).toEqualTypeOf<unknown[]>();
        expectTypeOf(base.paramCount).toEqualTypeOf<number>();
        return base;
      }

      public invokeFilterClauses(filter: MetadataFilter): FilterClausesResult {
        return this.buildFilterClauses(filter);
      }
    }

    expectTypeOf(SubclassPGVectorStore).toBeConstructibleWith(
      {} as EmbeddingsInterface,
      {} as PGVectorStoreArgs,
    );
  });
});
