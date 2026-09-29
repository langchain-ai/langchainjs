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
 * Focused matrix for the `jsonbContains` operator, split into the paths that
 * should translate to a containment clause and the paths that should not.
 *
 * Row-count semantics for these filters are covered against a live database in
 * `jsonb_contains.int.test.ts`; this file pins the generated SQL, the bound
 * parameters, and the behaviour of invalid input.
 */
describe("jsonbContains SQL generation", () => {
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
  const params = () => pool.query.mock.calls[0][1] as unknown[];
  const warnings = () => warnSpy.mock.calls.map((c) => c[0] as string);

  // ================================================================== happy ==

  describe("happy path: object values produce a containment clause", () => {
    test("emits a jsonb containment clause", async () => {
      await store.similaritySearchVectorWithScore([0.1], 5, {
        profile: { jsonbContains: { tier: "gold" } },
      });
      expect(sql()).toContain("(metadata -> $3) @> $4::jsonb");
    });

    test("binds the key and the serialized value as separate parameters", async () => {
      await store.similaritySearchVectorWithScore([0.1], 5, {
        profile: { jsonbContains: { tier: "gold" } },
      });
      expect(params()[2]).toBe("profile");
      expect(params()[3]).toBe('{"tier":"gold"}');
    });

    test.each([
      ["flat", { tier: "gold" }, '{"tier":"gold"}'],
      ["nested", { address: { city: "SF" } }, '{"address":{"city":"SF"}}'],
      [
        "multiple keys",
        { tier: "gold", region: "eu" },
        '{"tier":"gold","region":"eu"}',
      ],
      ["empty object", {}, "{}"],
      ["null value", { a: null }, '{"a":null}'],
      ["array value", { a: [1, 2] }, '{"a":[1,2]}'],
      ["boolean value", { a: true }, '{"a":true}'],
      ["numeric value", { a: 1.5 }, '{"a":1.5}'],
      ["negative numeric", { a: -3 }, '{"a":-3}'],
    ])("serializes a %s filter value", async (_name, value, expected) => {
      await store.similaritySearchVectorWithScore([0.1], 5, {
        p: { jsonbContains: value },
      } as MetadataFilter);
      expect(params()[3]).toBe(expected);
      expect(sql()).toContain("@> $");
    });

    test("does not warn for a valid object value", async () => {
      await store.similaritySearchVectorWithScore([0.1], 5, {
        profile: { jsonbContains: { tier: "gold" } },
      });
      expect(warnings()).toHaveLength(0);
    });

    test("ANDs with other operators without disturbing them", async () => {
      await store.similaritySearchVectorWithScore([0.1], 5, {
        profile: { jsonbContains: { tier: "gold" } },
        score: { gte: 50 },
        kind: { in: ["customer", "lead"] },
      });
      expect(sql()).toContain("(metadata -> $3) @> $4::jsonb");
      expect(sql()).toContain(">=");
      expect(sql()).toContain("IN (");
      expect(warnings()).toHaveLength(0);
    });

    test("keeps parameter numbering contiguous with a collection", async () => {
      pool.query.mockClear();
      const collPool = {
        // getOrCreateCollection reads the id back from the SELECT.
        query: vi.fn().mockResolvedValue({ rows: [{ uuid: "coll-uuid" }] }),
        connect: vi.fn().mockResolvedValue({ release: vi.fn() }),
        end: vi.fn().mockResolvedValue(undefined),
      };
      const collStore = new PGVectorStore(new MockEmbeddings(), {
        tableName: "test_table",
        pool: collPool,
        collectionTableName: "collections",
      });
      await collStore.similaritySearchVectorWithScore([0.1], 5, {
        profile: { jsonbContains: { tier: "gold" } },
      });
      // The first call resolves the collection id; the search is the last.
      const collSql = collPool.query.mock.calls.at(-1)?.[0] as string;
      expect(collSql).toContain("collection_id = $3");
      expect(collSql).toContain("(metadata -> $4) @> $5::jsonb");
    });

    test("honours a custom metadata column name", async () => {
      const customStore = new PGVectorStore(new MockEmbeddings(), {
        tableName: "test_table",
        pool,
        columns: { metadataColumnName: "meta_col" },
      });
      await customStore.similaritySearchVectorWithScore([0.1], 5, {
        profile: { jsonbContains: { tier: "gold" } },
      });
      const customSql = pool.query.mock.calls[0][0] as string;
      expect(customSql).toContain("(meta_col -> $3) @> $4::jsonb");
    });
  });

  // ================================================================ unhappy ==

  describe("unhappy path: invalid values are dropped and reported", () => {
    test.each([
      ["null", null],
      ["string", "gold"],
      ["number", 42],
      ["boolean", true],
      ["array", ["a"]],
    ])("a %s value produces no clause", async (_name, value) => {
      await store.similaritySearchVectorWithScore([0.1], 5, {
        p: { jsonbContains: value },
      } as unknown as MetadataFilter);
      expect(sql()).not.toContain("@>");
      expect(sql()).not.toContain("WHERE");
    });

    test.each([
      ["null", null],
      ["string", "gold"],
      ["number", 42],
      ["boolean", true],
      ["array", ["a"]],
    ])("a %s value is reported to the caller", async (_name, value) => {
      await store.similaritySearchVectorWithScore([0.1], 5, {
        p: { jsonbContains: value },
      } as unknown as MetadataFilter);
      expect(warnings()).toHaveLength(1);
      expect(warnings()[0]).toContain("p.jsonbContains");
      expect(warnings()[0]).toContain("invalid value for this operator");
    });

    test("does not throw on an invalid value", async () => {
      await expect(
        store.similaritySearchVectorWithScore([0.1], 5, {
          p: { jsonbContains: "gold" },
        } as unknown as MetadataFilter)
      ).resolves.toBeDefined();
    });

    test("consumes no parameters when the value is invalid", async () => {
      await store.similaritySearchVectorWithScore([0.1], 5, {
        bad: { jsonbContains: "gold" },
        good: { gte: 5 },
      } as unknown as MetadataFilter);
      // $1 embedding, $2 k, $3 good key, $4 value. Nothing for `bad`.
      expect(params()).toHaveLength(4);
      expect(params()[2]).toBe("good");
    });

    test("an invalid sibling does not suppress a valid clause", async () => {
      await store.similaritySearchVectorWithScore([0.1], 5, {
        bad: { jsonbContains: "gold" },
        good: { jsonbContains: { tier: "silver" } },
      } as unknown as MetadataFilter);
      expect(sql()).toContain("(metadata -> $3) @> $4::jsonb");
      expect(params()[3]).toBe('{"tier":"silver"}');
      expect(warnings()).toHaveLength(1);
    });
  });

  // ================================================================= safety ==

  describe("unhappy path: hostile input is bound, never interpolated", () => {
    test("an injection-shaped value cannot reach the SQL string", async () => {
      const payload = "gold'; DROP TABLE test_table; --";
      await store.similaritySearchVectorWithScore([0.1], 5, {
        p: { jsonbContains: { tier: payload } },
      });
      expect(sql()).not.toContain("DROP TABLE");
      expect(sql()).not.toContain(payload);
      expect(params()[3]).toContain("DROP TABLE");
    });

    test("an injection-shaped key cannot reach the SQL string", async () => {
      const key = "k'); DROP TABLE test_table; --";
      await store.similaritySearchVectorWithScore([0.1], 5, {
        [key]: { jsonbContains: { tier: "gold" } },
      });
      expect(sql()).not.toContain("DROP TABLE");
      expect(sql()).not.toContain(key);
      expect(params()[2]).toBe(key);
    });

    test("a quote-only key is still parameterized", async () => {
      await store.similaritySearchVectorWithScore([0.1], 5, {
        "'": { jsonbContains: { a: 1 } },
      });
      expect(sql()).toContain("@> $");
      expect(params()[2]).toBe("'");
    });
  });

  // ================================================================ delete ===

  describe("unhappy and happy paths for delete", () => {
    test("delete emits a containment clause", async () => {
      await store.delete({
        filter: { p: { jsonbContains: { tier: "gold" } } },
      });
      expect(sql().trimStart()).toMatch(/^DELETE/);
      expect(sql()).toContain("(metadata -> $1) @> $2::jsonb");
    });

    test("delete reports an invalid value", async () => {
      await store.delete({
        filter: { p: { jsonbContains: null } } as unknown as MetadataFilter,
      });
      expect(warnings()).toHaveLength(1);
      expect(warnings()[0]).toContain("p.jsonbContains");
    });
  });
});
