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

const tableName = "int_test_jsonb_contains";
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

function createStore({ withCollection = false } = {}) {
  return PGVectorStore.initialize(new SyntheticEmbeddings({ vectorSize: 8 }), {
    tableName,
    postgresConnectionOptions: poolConfig,
    collectionTableName: withCollection ? collectionTableName : undefined,
    collectionName: withCollection ? "c1" : undefined,
  });
}

describe("PGVectorStore jsonbContains filter (integration)", () => {
  // `initialize` issues CREATE TABLE IF NOT EXISTS, so the table has to be
  // dropped per test or documents accumulate across the suite.
  beforeEach(async () => {
    await dropTables();
  });

  afterAll(async () => {
    await dropTables();
  });

  test("matches documents whose nested JSONB contains the given object", async () => {
    const store = await createStore();

    await store.addDocuments([
      new Document({
        pageContent: "gold tier customer",
        metadata: { profile: { tier: "gold", region: "eu", since: 2019 } },
      }),
      new Document({
        pageContent: "silver tier customer",
        metadata: { profile: { tier: "silver", region: "us", since: 2021 } },
      }),
      new Document({
        pageContent: "no profile at all",
        metadata: { kind: "lead" },
      }),
    ]);

    const results = await store.similaritySearch("gold tier customer", 10, {
      profile: { jsonbContains: { tier: "gold" } },
    });

    expect(results).toHaveLength(1);
    expect(results[0].pageContent).toBe("gold tier customer");

    await store.end();
  });

  test("is a partial match, not equality", async () => {
    const store = await createStore();

    await store.addDocuments([
      new Document({
        pageContent: "has extra keys",
        metadata: { profile: { tier: "gold", region: "eu", since: 2019 } },
      }),
    ]);

    // The stored object has three keys; the filter specifies only one. `@>` is
    // containment, so this must still match.
    const results = await store.similaritySearch("has extra keys", 10, {
      profile: { jsonbContains: { tier: "gold" } },
    });

    expect(results).toHaveLength(1);

    await store.end();
  });

  test("requires every key in the filter object to be present", async () => {
    const store = await createStore();

    await store.addDocuments([
      new Document({
        pageContent: "gold in eu only",
        metadata: { profile: { tier: "gold", region: "eu" } },
      }),
    ]);

    const results = await store.similaritySearch("gold in eu only", 10, {
      profile: { jsonbContains: { tier: "gold", region: "us" } },
    });

    expect(results).toHaveLength(0);

    await store.end();
  });

  test("returns no rows when the metadata key is absent", async () => {
    const store = await createStore();

    await store.addDocuments([
      new Document({
        pageContent: "flat metadata only",
        metadata: { kind: "lead" },
      }),
    ]);

    // `metadata -> 'profile'` is NULL here, so the containment check is NULL
    // and the row is excluded rather than erroring.
    const results = await store.similaritySearch("flat metadata only", 10, {
      profile: { jsonbContains: { tier: "gold" } },
    });

    expect(results).toHaveLength(0);

    await store.end();
  });

  test("matches nested structures, not just flat keys", async () => {
    const store = await createStore();

    await store.addDocuments([
      new Document({
        pageContent: "deeply nested",
        metadata: {
          attrs: { address: { city: "San Francisco", zip: "94103" } },
        },
      }),
      new Document({
        pageContent: "different city",
        metadata: { attrs: { address: { city: "New York", zip: "10001" } } },
      }),
    ]);

    const results = await store.similaritySearch("deeply nested", 10, {
      attrs: { jsonbContains: { address: { city: "San Francisco" } } },
    });

    expect(results).toHaveLength(1);
    expect(
      (results[0].metadata.attrs as Record<string, unknown>).address
    ).toEqual({ city: "San Francisco", zip: "94103" });

    await store.end();
  });

  test("composes with other filter operators in the same query", async () => {
    const store = await createStore();

    await store.addDocuments([
      new Document({
        pageContent: "gold eu high score",
        metadata: {
          profile: { tier: "gold", region: "eu" },
          score: 90,
          kind: "customer",
        },
      }),
      new Document({
        // excluded by the `score` clause
        pageContent: "gold eu low score",
        metadata: {
          profile: { tier: "gold", region: "eu" },
          score: 10,
          kind: "customer",
        },
      }),
      new Document({
        // excluded by the `kind` clause
        pageContent: "gold us high score",
        metadata: {
          profile: { tier: "gold", region: "us" },
          score: 90,
          kind: "internal",
        },
      }),
    ]);

    const results = await store.similaritySearch("gold eu high score", 10, {
      profile: { jsonbContains: { tier: "gold" } },
      score: { gte: 50 },
      kind: { in: ["customer", "lead"] },
    });

    expect(results).toHaveLength(1);
    expect(results[0].pageContent).toBe("gold eu high score");

    await store.end();
  });

  test("works for delete by filter as well as search", async () => {
    const store = await createStore();

    await store.addDocuments([
      new Document({
        pageContent: "keep me",
        metadata: { profile: { tier: "silver" } },
      }),
      new Document({
        pageContent: "remove me",
        metadata: { profile: { tier: "gold" } },
      }),
    ]);

    await store.delete({
      filter: {
        profile: { jsonbContains: { tier: "gold" } },
      } as MetadataFilter,
    });

    const remaining = await store.similaritySearch("keep me", 10);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].pageContent).toBe("keep me");

    await store.end();
  });

  test("treats injection-shaped values as data, not SQL", async () => {
    const store = await createStore();

    const payload = "gold'; DROP TABLE int_test_jsonb_contains; --";
    await store.addDocuments([
      new Document({
        pageContent: "hostile payload",
        metadata: { profile: { tier: payload } },
      }),
    ]);

    const results = await store.similaritySearch("hostile payload", 10, {
      profile: { jsonbContains: { tier: payload } },
    });

    expect(results).toHaveLength(1);

    // The table must still exist, proving the payload was bound as a value.
    const after = await store.similaritySearch("hostile payload", 10);
    expect(after).toHaveLength(1);

    await store.end();
  });

  test("keeps parameter offsets correct when a collection is in use", async () => {
    const store = await createStore({ withCollection: true });

    await store.addDocuments([
      new Document({
        pageContent: "gold",
        metadata: { profile: { tier: "gold" }, score: 5 },
      }),
      new Document({
        pageContent: "silver",
        metadata: { profile: { tier: "silver" }, score: 5 },
      }),
    ]);

    // With a collection the base parameters are ($1 embedding, $2 k,
    // $3 collection), so filter parameters must start at $4. A wrong offset
    // would shift the embedding or the collection id.
    const results = await store.similaritySearch("gold", 10, {
      profile: { jsonbContains: { tier: "gold" } },
      score: { gte: 1 },
    });

    expect(results).toHaveLength(1);
    expect(results[0].pageContent).toBe("gold");

    await store.end();
  });

  test("ANDs multiple jsonbContains clauses on different keys", async () => {
    const store = await createStore();

    await store.addDocuments([
      new Document({
        pageContent: "both",
        metadata: { a: { v: 1 }, b: { w: 2 } },
      }),
      new Document({
        pageContent: "only a",
        metadata: { a: { v: 1 }, b: { w: 99 } },
      }),
    ]);

    const results = await store.similaritySearch("both", 10, {
      a: { jsonbContains: { v: 1 } },
      b: { jsonbContains: { w: 2 } },
    });

    expect(results).toHaveLength(1);
    expect(results[0].pageContent).toBe("both");

    await store.end();
  });

  test("is type-strict, matching jsonb equality semantics", async () => {
    const store = await createStore();

    await store.addDocuments([
      new Document({ pageContent: "numeric", metadata: { m: { v: 1 } } }),
    ]);

    // jsonb treats 1 and 1.0 as the same number.
    const numeric = await store.similaritySearch("numeric", 10, {
      m: { jsonbContains: { v: 1.0 } },
    });
    expect(numeric).toHaveLength(1);

    // ...but "1" is a string, not the number 1, so it must not match.
    const string = await store.similaritySearch("numeric", 10, {
      m: { jsonbContains: { v: "1" } },
    });
    expect(string).toHaveLength(0);

    await store.end();
  });

  test("treats a null value inside the filter object as a real key match", async () => {
    const store = await createStore();

    await store.addDocuments([
      new Document({
        pageContent: "has explicit null",
        metadata: { m: { a: null } },
      }),
      new Document({ pageContent: "no such key", metadata: { m: { b: 1 } } }),
    ]);

    // jsonb distinguishes a key present with a null value from an absent
    // key, and containment preserves that distinction.
    const results = await store.similaritySearch("x", 10, {
      m: { jsonbContains: { a: null } },
    });

    expect(results).toHaveLength(1);
    expect(results[0].pageContent).toBe("has explicit null");

    await store.end();
  });

  test("matches boolean, numeric and null values stored in nested objects", async () => {
    const store = await createStore();

    await store.addDocuments([
      new Document({
        pageContent: "mixed scalars",
        metadata: { m: { t: true, f: false, n: null, i: -3, z: 0 } },
      }),
      new Document({
        pageContent: "different values",
        metadata: { m: { t: true, f: true, n: null, i: 3, z: 1 } },
      }),
    ]);

    const results = await store.similaritySearch("x", 10, {
      m: { jsonbContains: { t: true, f: false, n: null, i: -3, z: 0 } },
    });

    expect(results).toHaveLength(1);
    expect(results[0].pageContent).toBe("mixed scalars");

    await store.end();
  });

  test("handles keys and values containing unicode, emoji and newlines", async () => {
    const store = await createStore();
    const key = "\u{1F511}key\u0001ctrl";

    await store.addDocuments([
      new Document({
        pageContent: "unicode",
        metadata: { [key]: { "\u{1F680}val": "line\nbreak\ttab" } },
      }),
      new Document({ pageContent: "plain", metadata: { other: 1 } }),
    ]);

    const results = await store.similaritySearch("x", 10, {
      [key]: { jsonbContains: { "\u{1F680}val": "line\nbreak\ttab" } },
    });

    expect(results).toHaveLength(1);
    expect(results[0].pageContent).toBe("unicode");

    await store.end();
  });

  test("treats an empty-string key as an ordinary key", async () => {
    const store = await createStore();

    await store.addDocuments([
      new Document({ pageContent: "empty key", metadata: { "": { t: 1 } } }),
      new Document({ pageContent: "other", metadata: { z: { t: 1 } } }),
    ]);

    const results = await store.similaritySearch("x", 10, {
      "": { jsonbContains: { t: 1 } },
    });

    expect(results).toHaveLength(1);
    expect(results[0].pageContent).toBe("empty key");

    await store.end();
  });

  test("binds an injection-shaped key as data rather than SQL", async () => {
    const store = await createStore();
    const tableName = "int_test_jsonb_contains";
    const key = `k'); DROP TABLE ${tableName}; --`;

    await store.addDocuments([
      new Document({
        pageContent: "hostile key",
        metadata: { [key]: { t: 1 } },
      }),
      new Document({ pageContent: "innocent", metadata: { safe: 1 } }),
    ]);

    const results = await store.similaritySearch("x", 10, {
      [key]: { jsonbContains: { t: 1 } },
    });

    expect(results).toHaveLength(1);
    expect(results[0].pageContent).toBe("hostile key");

    // The table must still exist, proving the key was bound as a value.
    const after = await store.similaritySearch("x", 10);
    expect(after).toHaveLength(2);

    await store.end();
  });

  test("distinguishes keys that differ only by case", async () => {
    const store = await createStore();

    await store.addDocuments([
      new Document({ pageContent: "upper", metadata: { P: { t: "gold" } } }),
      new Document({ pageContent: "lower", metadata: { p: { t: "gold" } } }),
    ]);

    const results = await store.similaritySearch("x", 10, {
      P: { jsonbContains: { t: "gold" } },
    });

    expect(results).toHaveLength(1);
    expect(results[0].pageContent).toBe("upper");

    await store.end();
  });

  test("handles a large filter object", async () => {
    const store = await createStore();
    const big: Record<string, { n: number }> = {};
    for (let i = 0; i < 200; i += 1) big[`k${i}`] = { n: i };

    await store.addDocuments([
      new Document({ pageContent: "big", metadata: { blob: big } }),
      new Document({
        pageContent: "small",
        metadata: { blob: { k0: { n: 0 } } },
      }),
    ]);

    const results = await store.similaritySearch("x", 10, {
      blob: {
        jsonbContains: { k0: { n: 0 }, k100: { n: 100 }, k199: { n: 199 } },
      },
    });

    expect(results).toHaveLength(1);
    expect(results[0].pageContent).toBe("big");

    await store.end();
  });

  test("ignores a non-object jsonbContains value rather than erroring", async () => {
    const store = await createStore();

    await store.addDocuments([
      new Document({
        pageContent: "scalar profile",
        metadata: { profile: "gold" },
      }),
    ]);

    // `jsonbContains` is typed for objects only. A string is skipped, leaving
    // no clause at all, so the search degrades to unfiltered rather than
    // throwing.
    const results = await store.similaritySearch("scalar profile", 10, {
      profile: { jsonbContains: "gold" },
    } as unknown as MetadataFilter);

    expect(results).toHaveLength(1);

    await store.end();
  });

  test("an empty in list matches nothing rather than erroring", async () => {
    const store = await createStore();

    await store.addDocuments([
      new Document({ pageContent: "a", metadata: { k: "x" } }),
      new Document({ pageContent: "b", metadata: { k: "y" } }),
    ]);

    // `in: []` expands to `IN ()`, which is invalid SQL, so the store
    // short-circuits to a clause that matches nothing.
    const results = await store.similaritySearch("x", 10, { k: { in: [] } });

    expect(results).toHaveLength(0);

    await store.end();
  });

  test("an empty notIn list returns everything rather than erroring", async () => {
    const store = await createStore();

    await store.addDocuments([
      new Document({ pageContent: "a", metadata: { k: "x" } }),
      new Document({ pageContent: "b", metadata: { k: "y" } }),
    ]);

    // Excluding nothing excludes nothing, so the clause is dropped.
    const results = await store.similaritySearch("x", 10, { k: { notIn: [] } });

    expect(results).toHaveLength(2);

    await store.end();
  });

  test("warns about an unrecognized filter operator", async () => {
    const store = await createStore();

    await store.addDocuments([
      new Document({ pageContent: "a", metadata: { k: "x" } }),
    ]);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // `exists` is not a supported operator here, so the clause cannot be
    // translated. The result set is unchanged, but the caller is told.
    const results = await store.similaritySearch("x", 10, {
      k: { exists: true },
    } as unknown as MetadataFilter);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain("k.exists");
    expect(results).toHaveLength(1);

    warnSpy.mockRestore();
    await store.end();
  });

  test("does not warn for supported operators", async () => {
    const store = await createStore();

    await store.addDocuments([
      new Document({ pageContent: "a", metadata: { k: "x" } }),
    ]);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const results = await store.similaritySearch("x", 10, {
      k: { in: ["x"], notIn: ["y"], neq: "z", gt: 0, lte: 9 },
      p: { jsonbContains: { t: 1 } },
    });

    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
    await store.end();
  });
});
