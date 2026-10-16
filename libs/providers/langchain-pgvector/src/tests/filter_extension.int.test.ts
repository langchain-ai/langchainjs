import { describe, expect, test, beforeEach, afterAll, vi } from "vitest";
import pg from "pg";
import { Document } from "@langchain/core/documents";
import { SyntheticEmbeddings } from "@langchain/core/utils/testing";
import { PGVectorStore } from "../vectorstores.js";
import type { MetadataFilter } from "../vectorstores.js";

const poolConfig = {
  host: process.env.PGVECTOR_HOST || "localhost",
  port: Number(process.env.PGVECTOR_PORT || 55432),
  user: process.env.PGVECTOR_USER || "postgres",
  password: process.env.PGVECTOR_PASSWORD || "postgres",
  database: process.env.PGVECTOR_DATABASE || "pgvector",
};

const tableName = "int_test_filter_extension";
const collectionTableName = `${tableName}_colls`;

async function dropTables() {
  const client = new pg.Client(poolConfig);
  await client.connect();
  try {
    await client.query(`DROP TABLE IF EXISTS ${tableName} CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS ${collectionTableName} CASCADE;`);
  } finally {
    await client.end();
  }
}

type ClauseResult = {
  whereClauses: string[];
  parameters: unknown[];
  paramCount: number;
};

/**
 * Adds a `jsonbContains` operator backed by Postgres JSONB containment (`@>`).
 *
 * This is the operator #11710 asks for, supplied through the extension point
 * that `protected buildFilterClauses` provides. It follows the three rules the
 * method documents: continue the parameter numbering from `paramOffset`, remove
 * your own operator from a shallow copy before delegating so the base class does
 * not warn about it, and bind both key and value as parameters.
 */
class JsonbStore extends PGVectorStore {
  protected override buildFilterClauses(
    filter: MetadataFilter,
    paramOffset = 0
  ): ClauseResult {
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
      // Keep any other operators on this key so the base class handles them.
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
}

/**
 * `PGVectorStore.initialize` hardcodes `new PGVectorStore(...)`, so calling it
 * on a subclass would silently return a base instance. A subclass has to be
 * constructed with `new` and set its own table up.
 */
async function createJsonbStore({ withCollection = false } = {}) {
  const store = new JsonbStore(new SyntheticEmbeddings({ vectorSize: 8 }), {
    tableName,
    postgresConnectionOptions: poolConfig,
    collectionTableName: withCollection ? collectionTableName : undefined,
    collectionName: withCollection ? "c1" : undefined,
  });
  await store.ensureTableInDatabase(8);
  if (withCollection) {
    await store.ensureCollectionTableInDatabase();
  }
  return store;
}

function createBaseStore() {
  return PGVectorStore.initialize(new SyntheticEmbeddings({ vectorSize: 8 }), {
    tableName,
    postgresConnectionOptions: poolConfig,
  });
}

describe("PGVectorStore filter extension (integration)", () => {
  // `ensureTableInDatabase` issues CREATE TABLE IF NOT EXISTS, so the table has
  // to be dropped per test or documents accumulate across the suite.
  beforeEach(async () => {
    await dropTables();
  });

  afterAll(async () => {
    await dropTables();
  });

  // ================================================================== happy ==

  describe("happy path: containment semantics via the subclass", () => {
    test("matches documents whose JSONB contains the given object", async () => {
      const store = await createJsonbStore();
      await store.addDocuments([
        new Document({
          pageContent: "gold user",
          metadata: { profile: { tier: "gold", region: "eu" } },
        }),
        new Document({
          pageContent: "silver user",
          metadata: { profile: { tier: "silver" } },
        }),
      ]);

      const results = await store.similaritySearch("x", 10, {
        profile: { jsonbContains: { tier: "gold" } },
      } as unknown as MetadataFilter);

      expect(results).toHaveLength(1);
      expect(results[0].pageContent).toBe("gold user");

      await store.end();
    });

    test("is a partial match, not equality", async () => {
      const store = await createJsonbStore();
      await store.addDocuments([
        new Document({
          pageContent: "extra keys",
          metadata: { profile: { tier: "gold", extra: 1, more: "x" } },
        }),
      ]);

      const results = await store.similaritySearch("x", 10, {
        profile: { jsonbContains: { tier: "gold" } },
      } as unknown as MetadataFilter);

      expect(results).toHaveLength(1);

      await store.end();
    });

    test("requires every key in the filter object to be present", async () => {
      const store = await createJsonbStore();
      await store.addDocuments([
        new Document({
          pageContent: "one of two",
          metadata: { profile: { tier: "gold" } },
        }),
      ]);

      const results = await store.similaritySearch("x", 10, {
        profile: { jsonbContains: { tier: "gold", region: "eu" } },
      } as unknown as MetadataFilter);

      expect(results).toHaveLength(0);

      await store.end();
    });

    test("matches nested structures, not just flat keys", async () => {
      const store = await createJsonbStore();
      await store.addDocuments([
        new Document({
          pageContent: "nested",
          metadata: {
            profile: { address: { city: "SF", zip: "94103" }, tier: "gold" },
          },
        }),
        new Document({
          pageContent: "other city",
          metadata: { profile: { address: { city: "NY" } } },
        }),
      ]);

      const results = await store.similaritySearch("x", 10, {
        profile: { jsonbContains: { address: { city: "SF" } } },
      } as unknown as MetadataFilter);

      expect(results).toHaveLength(1);
      expect(results[0].pageContent).toBe("nested");

      await store.end();
    });

    test("ANDs multiple containment clauses on different keys", async () => {
      const store = await createJsonbStore();
      await store.addDocuments([
        new Document({
          pageContent: "both",
          metadata: { a: { x: 1 }, b: { y: 2 } },
        }),
        new Document({ pageContent: "only a", metadata: { a: { x: 1 } } }),
        new Document({ pageContent: "only b", metadata: { b: { y: 2 } } }),
      ]);

      const results = await store.similaritySearch("x", 10, {
        a: { jsonbContains: { x: 1 } },
        b: { jsonbContains: { y: 2 } },
      } as unknown as MetadataFilter);

      expect(results).toHaveLength(1);
      expect(results[0].pageContent).toBe("both");

      await store.end();
    });

    test("treats a null value inside the filter object as a real key match", async () => {
      const store = await createJsonbStore();
      await store.addDocuments([
        new Document({ pageContent: "has null", metadata: { p: { a: null } } }),
        new Document({ pageContent: "no key", metadata: { p: { b: 1 } } }),
      ]);

      const results = await store.similaritySearch("x", 10, {
        p: { jsonbContains: { a: null } },
      } as unknown as MetadataFilter);

      expect(results).toHaveLength(1);
      expect(results[0].pageContent).toBe("has null");

      await store.end();
    });

    test("matches boolean and numeric values in nested objects", async () => {
      const store = await createJsonbStore();
      await store.addDocuments([
        new Document({
          pageContent: "flags",
          metadata: { p: { active: true, score: 1.5, neg: -3 } },
        }),
      ]);

      const results = await store.similaritySearch("x", 10, {
        p: { jsonbContains: { active: true, score: 1.5, neg: -3 } },
      } as unknown as MetadataFilter);

      expect(results).toHaveLength(1);

      await store.end();
    });

    test("distinguishes keys that differ only by case", async () => {
      const store = await createJsonbStore();
      await store.addDocuments([
        new Document({
          pageContent: "upper",
          metadata: { Tier: { tier: "gold" } },
        }),
      ]);

      const matched = await store.similaritySearch("x", 10, {
        Tier: { jsonbContains: { tier: "gold" } },
      } as unknown as MetadataFilter);
      const unmatched = await store.similaritySearch("x", 10, {
        tier: { jsonbContains: { tier: "gold" } },
      } as unknown as MetadataFilter);

      expect(matched).toHaveLength(1);
      expect(unmatched).toHaveLength(0);

      await store.end();
    });

    test("treats an empty-string key as an ordinary key", async () => {
      const store = await createJsonbStore();
      await store.addDocuments([
        new Document({ pageContent: "empty key", metadata: { "": "value" } }),
      ]);

      const results = await store.similaritySearch("x", 10, {
        "": { jsonbContains: { anything: 1 } },
      } as unknown as MetadataFilter);

      // `""` holds a string, so containment against an object is false.
      expect(results).toHaveLength(0);

      await store.end();
    });

    test("handles keys and values containing unicode and newlines", async () => {
      const store = await createJsonbStore();
      await store.addDocuments([
        new Document({
          pageContent: "unicode",
          metadata: { профиль: { уровень: "золото\n🚀" } },
        }),
      ]);

      const results = await store.similaritySearch("x", 10, {
        профиль: { jsonbContains: { уровень: "золото\n🚀" } },
      } as unknown as MetadataFilter);

      expect(results).toHaveLength(1);

      await store.end();
    });

    test("handles a large filter object", async () => {
      const store = await createJsonbStore();
      const big: Record<string, number> = {};
      for (let i = 0; i < 200; i += 1) {
        big[`k${i}`] = i;
      }
      await store.addDocuments([
        new Document({ pageContent: "big", metadata: { p: big } }),
      ]);

      const results = await store.similaritySearch("x", 10, {
        p: { jsonbContains: { k0: 0, k100: 100, k199: 199 } },
      } as unknown as MetadataFilter);

      expect(results).toHaveLength(1);

      await store.end();
    });

    test("composes with other filter operators in the same query", async () => {
      const store = await createJsonbStore();
      await store.addDocuments([
        new Document({
          pageContent: "keep",
          metadata: { profile: { tier: "gold" }, score: 80, kind: "lead" },
        }),
        new Document({
          pageContent: "low score",
          metadata: { profile: { tier: "gold" }, score: 10, kind: "lead" },
        }),
        new Document({
          pageContent: "wrong kind",
          metadata: { profile: { tier: "gold" }, score: 80, kind: "other" },
        }),
      ]);

      const results = await store.similaritySearch("x", 10, {
        profile: { jsonbContains: { tier: "gold" } },
        score: { gte: 50 },
        kind: { in: ["lead", "customer"] },
      } as unknown as MetadataFilter);

      expect(results).toHaveLength(1);
      expect(results[0].pageContent).toBe("keep");

      await store.end();
    });

    test("works for delete by filter as well as search", async () => {
      const store = await createJsonbStore();
      await store.addDocuments([
        new Document({
          pageContent: "gold",
          metadata: { profile: { tier: "gold" } },
        }),
        new Document({
          pageContent: "silver",
          metadata: { profile: { tier: "silver" } },
        }),
      ]);

      await store.delete({
        filter: {
          profile: { jsonbContains: { tier: "gold" } },
        } as unknown as MetadataFilter,
      });

      const remaining = await store.similaritySearch("x", 10);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].pageContent).toBe("silver");

      await store.end();
    });

    test("keeps parameter offsets correct when a collection is in use", async () => {
      const store = await createJsonbStore({ withCollection: true });
      await store.addDocuments([
        new Document({
          pageContent: "gold",
          metadata: { profile: { tier: "gold" } },
        }),
        new Document({
          pageContent: "silver",
          metadata: { profile: { tier: "silver" } },
        }),
      ]);

      const results = await store.similaritySearch("x", 10, {
        profile: { jsonbContains: { tier: "gold" } },
      } as unknown as MetadataFilter);

      // A mis-numbered override would bind the collection id or the embedding
      // to a text comparison and Postgres would raise a type error.
      expect(results).toHaveLength(1);
      expect(results[0].pageContent).toBe("gold");

      await store.end();
    });

    test("does not warn for a subclass operator", async () => {
      const store = await createJsonbStore();
      await store.addDocuments([
        new Document({
          pageContent: "gold",
          metadata: { profile: { tier: "gold" }, score: 5 },
        }),
      ]);

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await store.similaritySearch("x", 10, {
        profile: { jsonbContains: { tier: "gold" } },
        score: { gte: 1 },
        kind: { in: ["a"] },
        status: "ok",
      } as unknown as MetadataFilter);

      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
      await store.end();
    });
  });

  // ================================================================ unhappy ==

  describe("unhappy path: containment that must not match", () => {
    test("returns no rows when the metadata key is absent", async () => {
      const store = await createJsonbStore();
      await store.addDocuments([
        new Document({ pageContent: "no profile", metadata: { other: 1 } }),
      ]);

      const results = await store.similaritySearch("x", 10, {
        profile: { jsonbContains: { tier: "gold" } },
      } as unknown as MetadataFilter);

      expect(results).toHaveLength(0);

      await store.end();
    });

    test("returns no rows when the value differs", async () => {
      const store = await createJsonbStore();
      await store.addDocuments([
        new Document({
          pageContent: "bronze",
          metadata: { profile: { tier: "bronze" } },
        }),
      ]);

      const results = await store.similaritySearch("x", 10, {
        profile: { jsonbContains: { tier: "gold" } },
      } as unknown as MetadataFilter);

      expect(results).toHaveLength(0);

      await store.end();
    });

    test("is type-strict, matching JSONB containment semantics", async () => {
      const store = await createJsonbStore();
      await store.addDocuments([
        new Document({ pageContent: "number", metadata: { p: { n: 1 } } }),
        new Document({ pageContent: "string", metadata: { p: { n: "1" } } }),
      ]);

      const numeric = await store.similaritySearch("x", 10, {
        p: { jsonbContains: { n: 1 } },
      } as unknown as MetadataFilter);
      const textual = await store.similaritySearch("x", 10, {
        p: { jsonbContains: { n: "1" } },
      } as unknown as MetadataFilter);

      expect(numeric.map((r) => r.pageContent)).toEqual(["number"]);
      expect(textual.map((r) => r.pageContent)).toEqual(["string"]);

      await store.end();
    });

    test("does not match when the stored value is a scalar", async () => {
      const store = await createJsonbStore();
      await store.addDocuments([
        new Document({ pageContent: "scalar", metadata: { p: "gold" } }),
      ]);

      const results = await store.similaritySearch("x", 10, {
        p: { jsonbContains: { tier: "gold" } },
      } as unknown as MetadataFilter);

      expect(results).toHaveLength(0);

      await store.end();
    });

    test("an empty filter object matches every document holding an object", async () => {
      const store = await createJsonbStore();
      await store.addDocuments([
        new Document({ pageContent: "obj", metadata: { p: { a: 1 } } }),
        new Document({ pageContent: "scalar", metadata: { p: "x" } }),
      ]);

      const results = await store.similaritySearch("x", 10, {
        p: { jsonbContains: {} },
      } as unknown as MetadataFilter);

      expect(results.map((r) => r.pageContent)).toEqual(["obj"]);

      await store.end();
    });

    test("ignores a non-object containment value rather than erroring", async () => {
      const store = await createJsonbStore();
      await store.addDocuments([
        new Document({ pageContent: "a", metadata: { p: { t: 1 } } }),
      ]);

      // The override binds whatever it is given, so this reaches Postgres as
      // a JSON string. Containment against a scalar is false, not an error.
      const results = await store.similaritySearch("x", 10, {
        p: { jsonbContains: "gold" },
      } as unknown as MetadataFilter);

      expect(results).toHaveLength(0);

      await store.end();
    });

    test("the base store reports the operator instead of matching", async () => {
      const store = await createBaseStore();
      await store.addDocuments([
        new Document({
          pageContent: "gold",
          metadata: { profile: { tier: "gold" } },
        }),
      ]);

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const results = await store.similaritySearch("x", 10, {
        profile: { jsonbContains: { tier: "gold" } },
      } as unknown as MetadataFilter);

      // Without the subclass the clause is dropped, so the query runs
      // unfiltered. This is the silent failure the warning exists to surface.
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain("profile.jsonbContains");
      expect(results).toHaveLength(1);

      warnSpy.mockRestore();
      await store.end();
    });

    test("initialize on a subclass returns a base store, not the subclass", async () => {
      // Documented footgun: `initialize` hardcodes `new PGVectorStore(...)`,
      // so the override is silently discarded.
      const store = await JsonbStore.initialize(
        new SyntheticEmbeddings({ vectorSize: 8 }),
        { tableName, postgresConnectionOptions: poolConfig }
      );

      expect(store).toBeInstanceOf(PGVectorStore);
      expect(store).not.toBeInstanceOf(JsonbStore);

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      await store.similaritySearch("x", 10, {
        profile: { jsonbContains: { tier: "gold" } },
      } as unknown as MetadataFilter);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      warnSpy.mockRestore();

      await store.end();
    });
  });

  // ================================================================= safety ==

  describe("unhappy path: hostile input is bound, never interpolated", () => {
    test("treats injection-shaped values as data, not SQL", async () => {
      const store = await createJsonbStore();
      const payload = "gold'; DROP TABLE test_table; --";
      await store.addDocuments([
        new Document({
          pageContent: "safe",
          metadata: { profile: { tier: "gold" } },
        }),
      ]);

      const results = await store.similaritySearch("x", 10, {
        profile: { jsonbContains: { tier: payload } },
      } as unknown as MetadataFilter);

      // No error, table intact, and the payload simply does not match.
      expect(results).toHaveLength(0);

      // The table still exists and still has its row.
      const survivors = await store.similaritySearch("x", 10);
      expect(survivors).toHaveLength(1);

      await store.end();
    });

    test("binds an injection-shaped key as data rather than SQL", async () => {
      const store = await createJsonbStore();
      const key = "k'); DROP TABLE test_table; --";
      await store.addDocuments([
        new Document({ pageContent: "safe", metadata: { other: 1 } }),
      ]);

      const results = await store.similaritySearch("x", 10, {
        [key]: { jsonbContains: { tier: "gold" } },
      } as unknown as MetadataFilter);

      expect(results).toHaveLength(0);
      const survivors = await store.similaritySearch("x", 10);
      expect(survivors).toHaveLength(1);

      await store.end();
    });
  });

  // ============================================== base-class fixes still hold ==

  describe("the pre-existing filter bugs stay fixed on a subclass", () => {
    test("an empty in list matches nothing rather than erroring", async () => {
      const store = await createJsonbStore();
      await store.addDocuments([
        new Document({ pageContent: "a", metadata: { kind: "x" } }),
      ]);

      const results = await store.similaritySearch("x", 10, {
        kind: { in: [] },
      });

      expect(results).toHaveLength(0);

      await store.end();
    });

    test("an empty notIn list returns everything rather than erroring", async () => {
      const store = await createJsonbStore();
      await store.addDocuments([
        new Document({ pageContent: "a", metadata: { kind: "x" } }),
      ]);

      const results = await store.similaritySearch("x", 10, {
        kind: { notIn: [] },
      });

      expect(results).toHaveLength(1);

      await store.end();
    });

    test("an unknown operator still returns every row rather than erroring", async () => {
      const store = await createJsonbStore();
      await store.addDocuments([
        new Document({ pageContent: "gold", metadata: { p: { t: "gold" } } }),
        new Document({
          pageContent: "silver",
          metadata: { p: { t: "silver" } },
        }),
      ]);

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const results = await store.similaritySearch("x", 10, {
        p: { exists: true },
      } as unknown as MetadataFilter);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain("p.exists");
      expect(results).toHaveLength(2);

      warnSpy.mockRestore();
      await store.end();
    });

    test("an operator with a wrong-typed value warns and returns every row", async () => {
      const store = await createJsonbStore();
      await store.addDocuments([
        new Document({ pageContent: "a", metadata: { score: 10 } }),
        new Document({ pageContent: "b", metadata: { score: 90 } }),
      ]);

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const results = await store.similaritySearch("x", 10, {
        score: { gte: "50" },
      } as unknown as MetadataFilter);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain("score.gte");
      expect(results).toHaveLength(2);

      warnSpy.mockRestore();
      await store.end();
    });

    test("an empty operator object warns and returns every row", async () => {
      const store = await createJsonbStore();
      await store.addDocuments([
        new Document({ pageContent: "a", metadata: { p: { t: 1 } } }),
      ]);

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const results = await store.similaritySearch("x", 10, { p: {} });

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain("empty operator object");
      expect(results).toHaveLength(1);

      warnSpy.mockRestore();
      await store.end();
    });

    test("a base operator still filters when a subclass operator is dropped", async () => {
      const store = await createJsonbStore();
      await store.addDocuments([
        new Document({
          pageContent: "keep",
          metadata: { p: { t: "gold" }, n: 1 },
        }),
        new Document({
          pageContent: "drop",
          metadata: { p: { t: "silver" }, n: 2 },
        }),
      ]);

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const results = await store.similaritySearch("x", 10, {
        bad: { gte: "50" },
        n: { gte: 1 },
        p: { jsonbContains: { t: "gold" } },
      } as unknown as MetadataFilter);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(results).toHaveLength(1);
      expect(results[0].pageContent).toBe("keep");

      warnSpy.mockRestore();
      await store.end();
    });
  });
});
