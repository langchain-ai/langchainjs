import { describe, expect, test, vi, beforeEach } from "vitest";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { PGVectorFilterError, PGVectorStore } from "../vectorstores.js";
import type { MetadataFilter } from "../vectorstores.js";

class MockEmbeddings implements EmbeddingsInterface {
  async embedQuery(): Promise<number[]> {
    return [0.1, 0.2, 0.3];
  }
  async embedDocuments(): Promise<number[][]> {
    return [[0.1, 0.2, 0.3]];
  }
}

/**
 * Tests filter diagnostics in both modes: the default warns and keeps the
 * historical unfiltered behavior for backward compatibility, while
 * `throwOnInvalidFilter: true` rejects before the query runs. Every filter
 * entry that can be translated must be left alone in both modes.
 *
 * A dropped entry is the dangerous case, because the query then runs
 * unfiltered and silently returns more rows than the caller asked for.
 */
describe("filter diagnostics", () => {
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  let pool: any;
  let store: PGVectorStore;
  let strictStore: PGVectorStore;

  beforeEach(() => {
    pool = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      connect: vi.fn().mockResolvedValue({ release: vi.fn() }),
      end: vi.fn().mockResolvedValue(undefined),
    };
    store = new PGVectorStore(new MockEmbeddings(), {
      tableName: "test_table",
      pool,
    });
    strictStore = new PGVectorStore(new MockEmbeddings(), {
      tableName: "test_table",
      pool,
      throwOnInvalidFilter: true,
    });
  });

  const sql = () => pool.query.mock.calls[0][0] as string;

  /** Runs a filter and returns the error the strict store must reject with. */
  async function rejection(filter: unknown): Promise<Error> {
    try {
      await strictStore.similaritySearchVectorWithScore(
        [0.1],
        5,
        filter as MetadataFilter
      );
    } catch (error) {
      return error as Error;
    }
    throw new Error("expected the filter to be rejected");
  }

  /** Runs a filter on the default store and returns the warning it logs. */
  async function warning(filter: unknown): Promise<string> {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await store.similaritySearchVectorWithScore(
        [0.1],
        5,
        filter as MetadataFilter
      );
      expect(warnSpy).toHaveBeenCalledTimes(1);
      return warnSpy.mock.calls[0][0] as string;
    } finally {
      warnSpy.mockRestore();
    }
  }

  const errorCode = (error: Error) =>
    (error as Error & { lc_error_code?: string }).lc_error_code;

  // ---------------------------------------------------------------- happy --

  describe("happy path: every supported operator is translated", () => {
    test.each([
      ["in", { in: ["a", "b"] }],
      ["notIn", { notIn: ["a"] }],
      ["arrayContains", { arrayContains: ["a"] }],
      ["gt", { gt: 1 }],
      ["gte", { gte: 1 }],
      ["lt", { lt: 9 }],
      ["lte", { lte: 9 }],
      ["neq", { neq: "a" }],
    ])("%s produces a WHERE clause", async (_name, op) => {
      await store.similaritySearchVectorWithScore([0.1], 5, {
        k: op,
      } as never);
      expect(sql()).toContain("WHERE");
    });

    test("plain equality produces a WHERE clause", async () => {
      await store.similaritySearchVectorWithScore([0.1], 5, { k: "v" });
      expect(sql()).toContain("WHERE");
    });

    test("empty in list is handled, not rejected", async () => {
      await store.similaritySearchVectorWithScore([0.1], 5, {
        k: { in: [] },
      });
      // Short-circuited to FALSE rather than dropped.
      expect(sql()).toContain("FALSE");
    });

    test("empty notIn list is handled, not rejected", async () => {
      await store.similaritySearchVectorWithScore([0.1], 5, {
        k: { notIn: [] },
      });
      // Deliberately omitted: excluding nothing needs no constraint.
      expect(sql()).not.toContain("WHERE");
    });

    test("all supported operators together are accepted", async () => {
      await store.similaritySearchVectorWithScore([0.1], 5, {
        k: { in: ["a"], notIn: ["b"], arrayContains: ["c"], neq: "d" },
        lo: { gt: 1, gte: 1, lt: 9, lte: 9 },
      });
      expect(sql()).toContain("WHERE");
    });

    test("an operator only a subclass provides is rejected when throwOnInvalidFilter is true", async () => {
      // The base class cannot translate `jsonbContains`. A subclass that
      // handles the key first removes it, which is why the subclass path is
      // accepted.
      const error = await rejection({
        p: { jsonbContains: { tier: "gold" } },
      });
      expect(error.message).toContain("p.jsonbContains");
      expect(error.message).toContain("unsupported operator");
      expect(pool.query).not.toHaveBeenCalled();
    });

    test("neq accepts any value, since it is guarded by hasOwnProperty", async () => {
      for (const value of [null, 0, false, "", {}]) {
        pool.query.mockClear();
        await store.similaritySearchVectorWithScore([0.1], 5, {
          k: { neq: value },
        } as never);
        expect(sql()).toContain("WHERE");
      }
    });
  });

  // ------------------------------------------------------ default behavior --

  describe("default behavior: warns and keeps running", () => {
    test("an unknown operator warns instead of throwing", async () => {
      const message = await warning({ category: { exists: true } });
      expect(message).toContain("category.exists");
      expect(message).toContain("unsupported operator");
      expect(message).toContain("arrayContains");
      expect(message).toContain("throwOnInvalidFilter");
      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    test("a wrong-typed value warns instead of throwing", async () => {
      const message = await warning({ score: { gte: "50" } });
      expect(message).toContain("score.gte");
      expect(message).toContain("invalid value for this operator");
      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    test("an empty operator object warns instead of throwing", async () => {
      const message = await warning({ category: {} });
      expect(message).toContain("category");
      expect(message).toContain("empty operator object");
      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    test("supported filters do not warn", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      await store.similaritySearchVectorWithScore([0.1], 5, {
        category: { in: ["a"], neq: "b", gt: 1, lte: 9, notIn: ["z"] },
        tags: { arrayContains: ["x"] },
        plain: "value",
      });
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  // -------------------------------------------------------------- unhappy --

  describe("unhappy path: unsupported operators are rejected", () => {
    test("an unknown operator is rejected by name", async () => {
      const error = await rejection({ category: { exists: true } });
      expect(error.message).toContain("category.exists");
      expect(error.message).toContain("unsupported operator");
    });

    test("the error is named and coded for callers", async () => {
      const error = await rejection({ category: { exists: true } });
      expect(error).toBeInstanceOf(PGVectorFilterError);
      expect(PGVectorFilterError.isInstance(error)).toBe(true);
      expect(error.name).toBe("PGVectorFilterError");
      expect(errorCode(error)).toBe("INVALID_METADATA_FILTER");
    });

    test("an empty operator object is rejected", async () => {
      const error = await rejection({ category: {} });
      expect(error.message).toContain("category");
      expect(error.message).toContain("empty operator object");
      expect(pool.query).not.toHaveBeenCalled();
    });

    test.each([
      ["gte", { gte: "50" }],
      ["gt", { gt: "1" }],
      ["lt", { lt: "1" }],
      ["lte", { lte: "1" }],
      ["in", { in: "a" }],
      ["notIn", { notIn: "a" }],
      ["arrayContains", { arrayContains: "a" }],
    ])("%s with an invalid value is rejected", async (_name, op) => {
      const error = await rejection({ k: op });
      expect(error.message).toContain("invalid value for this operator");
      expect(pool.query).not.toHaveBeenCalled();
    });

    test("reports every bad entry in a single error", async () => {
      const error = await rejection({
        category: { exists: true, notExists: true },
        score: { between: [1, 2] },
        empty: {},
        bad: { gte: "50" },
      });
      const message = error.message;
      expect(message).toContain("category.exists");
      expect(message).toContain("category.notExists");
      expect(message).toContain("score.between");
      expect(message).toContain("empty");
      expect(message).toContain("bad.gte");
    });

    test("lists the supported operators so the message is actionable", async () => {
      const error = await rejection({ category: { exists: true } });
      for (const op of [
        "in",
        "notIn",
        "arrayContains",
        "gt",
        "gte",
        "lt",
        "lte",
        "neq",
      ]) {
        expect(error.message).toContain(op);
      }
    });

    test("mentions the subclass escape hatch", async () => {
      const error = await rejection({ category: { exists: true } });
      expect(error.message).toContain("override buildFilterClauses");
    });

    test("rejects delete filters too", async () => {
      await expect(
        strictStore.delete({ filter: { category: { exists: true } } as never })
      ).rejects.toMatchObject({ name: "PGVectorFilterError" });
      expect(pool.query).not.toHaveBeenCalled();
    });

    test("rejects before any query is issued", async () => {
      const error = await rejection({ category: { exists: true } });
      expect(error).toBeInstanceOf(Error);
      expect(pool.query).not.toHaveBeenCalled();
    });

    test("maxMarginalRelevanceSearch propagates the same filter error", async () => {
      await expect(
        strictStore.maxMarginalRelevanceSearch("query", {
          k: 2,
          filter: { category: { exists: true } } as never,
        })
      ).rejects.toMatchObject({
        name: "PGVectorFilterError",
        lc_error_code: "INVALID_METADATA_FILTER",
      });

      expect(pool.query).not.toHaveBeenCalled();
    });

    test("a bad entry rejects the whole filter", async () => {
      const error = await rejection({
        bad: { gte: "50" },
        good: { in: ["a"] },
      });
      // The whole query is rejected rather than running with only part of the
      // filter applied.
      expect(error.message).toContain("bad.gte");
      expect(error.message).not.toContain("good.in");
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------- parameter safety --

  describe("parameter numbering", () => {
    test("an empty in list consumes no parameters", async () => {
      await store.similaritySearchVectorWithScore([0.1], 5, {
        k: { in: [] },
        score: { gte: 50 },
      });
      // $1 embedding, $2 k, $3 score key, $4 value. The empty list adds none.
      expect(pool.query.mock.calls[0][1]).toHaveLength(4);
      expect(pool.query.mock.calls[0][1][2]).toBe("score");
    });

    test("an empty notIn list consumes no parameters", async () => {
      await store.similaritySearchVectorWithScore([0.1], 5, {
        k: { notIn: [] },
        score: { gte: 50 },
      });
      expect(pool.query.mock.calls[0][1]).toHaveLength(4);
      expect(pool.query.mock.calls[0][1][2]).toBe("score");
    });

    test("an unsupported operator never reaches the query", async () => {
      await rejection({
        category: { exists: true },
        score: { gte: 50 },
      });
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------ type safety --

  describe("hostile input", () => {
    test.each([
      ["a null filter", null],
      ["a string filter", "not a filter"],
      ["a number filter", 42],
      ["an array filter", ["a"]],
    ])("%s is handled without throwing", async (_name, filter) => {
      await expect(
        store.similaritySearchVectorWithScore(
          [0.1],
          5,
          filter as unknown as MetadataFilter
        )
      ).resolves.toBeDefined();
    });

    test("a prototype-polluting key produces the filter error rather than a crash", async () => {
      const error = await rejection({
        __proto__: { exists: true },
        constructor: { gte: "x" },
      } as never);
      expect(error.name).toBe("PGVectorFilterError");
      expect(error.message).toContain("constructor.gte");
      expect(pool.query).not.toHaveBeenCalled();
    });
  });
});
