import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { PGVectorStore } from "../vectorstores.js";
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
 * Tests the filter diagnostics: every filter entry that cannot be translated
 * into a WHERE clause must be reported, and every filter entry that can be
 * translated must be left alone.
 *
 * A dropped entry is the dangerous case, because the query then runs
 * unfiltered and silently returns more rows than the caller asked for.
 */
describe("filter diagnostics", () => {
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  let pool: any;
  let store: PGVectorStore;
  let warnSpy: ReturnType<typeof vi.spyOn>;

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
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  const sql = () => pool.query.mock.calls[0][0] as string;
  const warnings = () => warnSpy.mock.calls.map((c) => c[0] as string);

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
      ["jsonbContains", { jsonbContains: { tier: "gold" } }],
    ])("%s produces a WHERE clause and no warning", async (_name, op) => {
      await store.similaritySearchVectorWithScore([0.1], 5, {
        k: op,
      } as never);
      expect(sql()).toContain("WHERE");
      expect(warnings()).toHaveLength(0);
    });

    test("plain equality produces a WHERE clause and no warning", async () => {
      await store.similaritySearchVectorWithScore([0.1], 5, { k: "v" });
      expect(sql()).toContain("WHERE");
      expect(warnings()).toHaveLength(0);
    });

    test("empty in list is handled, not reported", async () => {
      await store.similaritySearchVectorWithScore([0.1], 5, {
        k: { in: [] },
      });
      // Short-circuited to FALSE rather than dropped.
      expect(sql()).toContain("FALSE");
      expect(warnings()).toHaveLength(0);
    });

    test("empty notIn list is handled, not reported", async () => {
      await store.similaritySearchVectorWithScore([0.1], 5, {
        k: { notIn: [] },
      });
      // Deliberately omitted: excluding nothing needs no constraint.
      expect(sql()).not.toContain("WHERE");
      expect(warnings()).toHaveLength(0);
    });

    test("all supported operators together produce no warning", async () => {
      await store.similaritySearchVectorWithScore([0.1], 5, {
        k: { in: ["a"], notIn: ["b"], arrayContains: ["c"], neq: "d" },
        lo: { gt: 1, gte: 1, lt: 9, lte: 9 },
        p: { jsonbContains: { tier: "gold" } },
      });
      expect(sql()).toContain("WHERE");
      expect(warnings()).toHaveLength(0);
    });

    test("neq accepts any value, since it is guarded by hasOwnProperty", async () => {
      for (const value of [null, 0, false, "", {}]) {
        pool.query.mockClear();
        warnSpy.mockClear();
        await store.similaritySearchVectorWithScore([0.1], 5, {
          k: { neq: value },
        } as never);
        expect(sql()).toContain("WHERE");
      }
      expect(warnings()).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------- unhappy --

  describe("unhappy path: unsupported operators are reported", () => {
    test("an unknown operator is reported by name", async () => {
      await store.similaritySearchVectorWithScore([0.1], 5, {
        category: { exists: true },
      } as never);
      expect(warnings()).toHaveLength(1);
      expect(warnings()[0]).toContain("category.exists");
      expect(warnings()[0]).toContain("unsupported operator");
    });

    test("an empty operator object is reported", async () => {
      await store.similaritySearchVectorWithScore([0.1], 5, {
        category: {},
      });
      expect(warnings()).toHaveLength(1);
      expect(warnings()[0]).toContain("category");
      expect(warnings()[0]).toContain("empty operator object");
      // No clause, so the query would run unfiltered.
      expect(sql()).not.toContain("WHERE");
    });

    test.each([
      ["gte", { gte: "50" }],
      ["gt", { gt: "1" }],
      ["lt", { lt: "1" }],
      ["lte", { lte: "1" }],
      ["in", { in: "a" }],
      ["notIn", { notIn: "a" }],
      ["arrayContains", { arrayContains: "a" }],
      ["jsonbContains null", { jsonbContains: null }],
      ["jsonbContains array", { jsonbContains: ["a"] }],
      ["jsonbContains string", { jsonbContains: "a" }],
      ["jsonbContains number", { jsonbContains: 1 }],
    ])("%s with an invalid value is reported", async (_name, op) => {
      await store.similaritySearchVectorWithScore([0.1], 5, {
        k: op,
      } as never);
      expect(warnings()).toHaveLength(1);
      expect(warnings()[0]).toContain("invalid value for this operator");
      expect(sql()).not.toContain("WHERE");
    });

    test("reports every bad entry in a single warning", async () => {
      await store.similaritySearchVectorWithScore([0.1], 5, {
        category: { exists: true, notExists: true },
        score: { between: [1, 2] },
        empty: {},
        bad: { gte: "50" },
      } as never);
      expect(warnings()).toHaveLength(1);
      const message = warnings()[0];
      expect(message).toContain("category.exists");
      expect(message).toContain("category.notExists");
      expect(message).toContain("score.between");
      expect(message).toContain("empty");
      expect(message).toContain("bad.gte");
    });

    test("lists the supported operators so the message is actionable", async () => {
      await store.similaritySearchVectorWithScore([0.1], 5, {
        category: { exists: true },
      } as never);
      const message = warnings()[0];
      for (const op of [
        "in",
        "notIn",
        "arrayContains",
        "gt",
        "gte",
        "lt",
        "lte",
        "neq",
        "jsonbContains",
      ]) {
        expect(message).toContain(op);
      }
    });

    test("warns for delete filters too", async () => {
      await store.delete({ filter: { category: { exists: true } } as never });
      expect(warnings()).toHaveLength(1);
      expect(warnings()[0]).toContain("category.exists");
    });

    test("reporting does not throw, so existing callers keep working", async () => {
      await expect(
        store.similaritySearchVectorWithScore([0.1], 5, {
          category: { exists: true },
        } as never)
      ).resolves.toBeDefined();
    });

    test("a bad entry does not suppress good entries in the same filter", async () => {
      await store.similaritySearchVectorWithScore([0.1], 5, {
        bad: { gte: "50" },
        good: { in: ["a"] },
      } as never);
      // The good clause is still emitted; only the bad one was dropped.
      expect(sql()).toContain("WHERE");
      expect(sql()).toContain("IN");
      expect(warnings()).toHaveLength(1);
      expect(warnings()[0]).toContain("bad.gte");
    });
  });

  // ------------------------------------------------------- parameter safety --

  describe("unhappy path: dropped entries must not corrupt parameters", () => {
    test("parameters stay contiguous when a bad entry is dropped", async () => {
      await store.similaritySearchVectorWithScore([0.1], 5, {
        bad: { gte: "50" },
        good: { in: ["a", "b"] },
      } as never);
      const querySql = sql();
      const params = pool.query.mock.calls[0][1] as unknown[];
      const referenced = [
        ...new Set([...querySql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]))),
      ].sort((a, b) => a - b);
      expect(referenced).toEqual([1, 2, 3, 4, 5]);
      expect(params).toHaveLength(5);
    });

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

    test("an unsupported operator consumes no parameters", async () => {
      await store.similaritySearchVectorWithScore([0.1], 5, {
        category: { exists: true },
        score: { gte: 50 },
      } as never);
      expect(pool.query.mock.calls[0][1]).toHaveLength(4);
      expect(pool.query.mock.calls[0][1][2]).toBe("score");
    });
  });

  // ------------------------------------------------------------ type safety --

  describe("unhappy path: the diagnostics never throw on hostile input", () => {
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
          filter as MetadataFilter
        )
      ).resolves.toBeDefined();
    });

    test("a prototype-polluting key name does not break the scan", async () => {
      await expect(
        store.similaritySearchVectorWithScore([0.1], 5, {
          __proto__: { exists: true },
          constructor: { gte: "x" },
        } as never)
      ).resolves.toBeDefined();
    });
  });
});
