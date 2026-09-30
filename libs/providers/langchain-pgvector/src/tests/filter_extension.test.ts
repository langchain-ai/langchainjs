import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import type { Pool } from "pg";
import { PGVectorStore } from "../vectorstores.js";
import type { MetadataFilter, PGVectorStoreArgs } from "../vectorstores.js";

class MockEmbeddings implements EmbeddingsInterface {
  async embedQuery(): Promise<number[]> {
    return [0.1, 0.2, 0.3];
  }
  async embedDocuments(): Promise<number[][]> {
    return [[0.1, 0.2, 0.3]];
  }
}

/**
 * A minimal `Pool`-shaped mock: just enough for the store to run queries
 * against. Cast at construction sites; the mock methods are what the tests
 * assert on.
 */
function createMockPool() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    connect: vi.fn().mockResolvedValue({ release: vi.fn() }),
    end: vi.fn().mockResolvedValue(undefined),
  };
}

type ClauseResult = {
  whereClauses: string[];
  parameters: unknown[];
  paramCount: number;
};

/**
 * Adds a `jsonbContains` operator, the operator this issue asks for, using
 * Postgres JSONB containment (`@>`).
 *
 * This is the shape a subclass has to follow, and it is the three rules the
 * `buildFilterClauses` doc comment describes: continue the parameter numbering
 * from `paramOffset`, remove your own operator from a shallow copy before
 * delegating so the base implementation does not warn about it, and bind both
 * the key and the value as parameters rather than interpolating them.
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
 * A second subclass, adding a regular-expression operator. It exists to show
 * the extension point is not specific to one operator, and to pin the
 * parameter-numbering contract with two independent overrides in play.
 */
class RegexStore extends PGVectorStore {
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
        !("regex" in (value as Record<string, unknown>))
      ) {
        remaining[key] = value;
        continue;
      }
      const { regex, ...rest } = value as Record<string, unknown>;
      paramCount += 1;
      parameters.push(key);
      const keyPlaceholder = `$${paramCount}`;
      paramCount += 1;
      parameters.push(regex);
      whereClauses.push(
        `(${this.metadataColumnName} ->> ${keyPlaceholder}) ~ $${paramCount}`
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
}

/**
 * `buildFilterClauses` is `protected`, so the filter builder is an extension
 * point. These tests pin the contract an override has to honour, because a
 * mistake in it misbinds parameters rather than throwing.
 */
describe("buildFilterClauses is an extension point", () => {
  let pool: ReturnType<typeof createMockPool>;
  let store: PGVectorStore;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    pool = createMockPool();
    store = new PGVectorStore(new MockEmbeddings(), {
      tableName: "test_table",
      pool: pool as unknown as Pool,
    });
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  const sql = () => pool.query.mock.calls[0][0] as string;
  const params = () => pool.query.mock.calls[0][1] as unknown[];
  const warnings = () =>
    warnSpy.mock.calls.map((call: unknown[]) => call[0] as string);

  const custom = <T extends PGVectorStore>(
    Cls: new (embeddings: EmbeddingsInterface, config: PGVectorStoreArgs) => T
  ) =>
    new Cls(new MockEmbeddings(), {
      tableName: "test_table",
      pool: pool as unknown as Pool,
    }) as T;

  // ---------------------------------------------------------------- happy --

  describe("happy path: a subclass operator reaches the query", () => {
    test("generates a JSONB containment clause", async () => {
      await custom(JsonbStore).similaritySearchVectorWithScore([0.1], 5, {
        profile: { jsonbContains: { tier: "gold" } },
      } as unknown as MetadataFilter);

      expect(sql()).toContain("(metadata -> $3) @> $4::jsonb");
    });

    test("binds the key and the serialized value as separate parameters", async () => {
      await custom(JsonbStore).similaritySearchVectorWithScore([0.1], 5, {
        profile: { jsonbContains: { tier: "gold", region: "eu" } },
      } as unknown as MetadataFilter);

      expect(params()[2]).toBe("profile");
      expect(params()[3]).toBe('{"tier":"gold","region":"eu"}');
    });

    test("does not warn about its own operator", async () => {
      await custom(JsonbStore).similaritySearchVectorWithScore([0.1], 5, {
        profile: { jsonbContains: { tier: "gold" } },
      } as unknown as MetadataFilter);

      // The subclass strips its key before delegating, so the base
      // implementation has nothing to report.
      expect(warnings()).toHaveLength(0);
    });

    test("composes with a base operator on the same key", async () => {
      await custom(JsonbStore).similaritySearchVectorWithScore([0.1], 5, {
        profile: { jsonbContains: { tier: "gold" }, neq: "bronze" },
      } as unknown as MetadataFilter);

      expect(sql()).toContain("@> $");
      expect(sql()).toContain("IS NULL OR");
      expect(warnings()).toHaveLength(0);
    });

    test("composes with base operators on other keys", async () => {
      await custom(JsonbStore).similaritySearchVectorWithScore([0.1], 5, {
        profile: { jsonbContains: { tier: "gold" } },
        score: { gte: 50 },
        kind: { in: ["a", "b"] },
      } as unknown as MetadataFilter);

      expect(sql()).toContain("@> $");
      expect(sql()).toContain(">=");
      expect(sql()).toContain("IN (");
      expect(params()).toContain("profile");
      expect(params()).toContain("kind");
      expect(warnings()).toHaveLength(0);
    });

    test("a second subclass works the same way", async () => {
      await custom(RegexStore).similaritySearchVectorWithScore([0.1], 5, {
        name: { regex: "^go" },
      } as unknown as MetadataFilter);

      expect(sql()).toContain("(metadata ->> $3) ~ $4");
      expect(params()[3]).toBe("^go");
      expect(warnings()).toHaveLength(0);
    });

    test("base operators are unaffected when a subclass is in play", async () => {
      await custom(JsonbStore).similaritySearchVectorWithScore([0.1], 5, {
        score: { gte: 50 },
        kind: { notIn: ["x"] },
        tags: { arrayContains: ["t"] },
        status: "active",
      });

      expect(sql()).toContain(">=");
      expect(sql()).toContain("NOT IN (");
      expect(sql()).toContain("?|");
      expect(warnings()).toHaveLength(0);
    });

    test("the base store still has no containment operator", async () => {
      // Pinning the boundary: `jsonbContains` is not built in, which is why
      // the subclass exists.
      await store.similaritySearchVectorWithScore([0.1], 5, {
        profile: { jsonbContains: { tier: "gold" } },
      } as unknown as MetadataFilter);

      expect(sql()).not.toContain("@>");
      expect(warnings()).toHaveLength(1);
      expect(warnings()[0]).toContain("profile.jsonbContains");
    });
  });

  // ---------------------------------------------- parameter number contract --

  describe("unhappy path: a mis-numbered override must be caught", () => {
    test("parameter numbering stays contiguous across the override", async () => {
      await custom(JsonbStore).similaritySearchVectorWithScore([0.1], 5, {
        profile: { jsonbContains: { tier: "gold" } },
        score: { gte: 50 },
      } as unknown as MetadataFilter);

      const querySql = sql();
      const referenced = [
        ...new Set([...querySql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]))),
      ].sort((a, b) => a - b);
      // $1 embedding, $2 limit, $3-$4 containment, $5-$6 gte.
      expect(referenced).toEqual([1, 2, 3, 4, 5, 6]);
      expect(params()).toHaveLength(6);
    });

    test("paramOffset is honoured for a collection-backed search", async () => {
      const collPool = {
        query: vi.fn().mockResolvedValue({ rows: [{ uuid: "coll-uuid" }] }),
        connect: vi.fn().mockResolvedValue({ release: vi.fn() }),
        end: vi.fn().mockResolvedValue(undefined),
      };
      const collStore = new JsonbStore(new MockEmbeddings(), {
        tableName: "test_table",
        pool: collPool as unknown as Pool,
        collectionTableName: "collections",
      });

      await collStore.similaritySearchVectorWithScore([0.1], 5, {
        profile: { jsonbContains: { tier: "gold" } },
      } as unknown as MetadataFilter);

      const querySql = collPool.query.mock.calls.at(-1)?.[0] as string;
      expect(querySql).toContain("collection_id = $3");
      // The collection consumed $3, so the override must start at $4.
      expect(querySql).toContain("(metadata -> $4) @> $5::jsonb");
    });

    test("an override that ignored paramOffset would be caught by this", async () => {
      // A subclass that started at $1 would produce a clause referencing $1,
      // which the embedding already occupies. Assert the clause never does.
      await custom(JsonbStore).similaritySearchVectorWithScore([0.1], 5, {
        profile: { jsonbContains: { tier: "gold" } },
      } as unknown as MetadataFilter);

      expect(sql()).toContain("(metadata -> $3) @> $4::jsonb");
      expect(sql()).not.toMatch(/metadata -> \$1/);
      expect(sql()).not.toMatch(/metadata -> \$2/);
    });

    test("delete-by-filter also routes through the override", async () => {
      await custom(JsonbStore).delete({
        filter: {
          profile: { jsonbContains: { tier: "gold" } },
        } as unknown as MetadataFilter,
      });

      expect(sql().trimStart()).toMatch(/^DELETE/);
      expect(sql()).toContain("(metadata -> $1) @> $2::jsonb");
      expect(warnings()).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------- safety --

  describe("unhappy path: an override is responsible for its own safety", () => {
    test("the base class does not sanitize what a subclass adds", async () => {
      const payload = "gold'; DROP TABLE test_table; --";
      await custom(JsonbStore).similaritySearchVectorWithScore([0.1], 5, {
        profile: { jsonbContains: { tier: payload } },
      } as unknown as MetadataFilter);

      // The override binds the value as a parameter, so it never reaches the
      // query string. This pins that the contract is what keeps it safe.
      expect(sql()).not.toContain(payload);
      expect(params()[3]).toContain(payload);
    });

    test("a hostile key is bound rather than interpolated", async () => {
      const key = "k'); DROP TABLE test_table; --";
      await custom(JsonbStore).similaritySearchVectorWithScore([0.1], 5, {
        [key]: { jsonbContains: { tier: "gold" } },
      } as unknown as MetadataFilter);

      expect(sql()).not.toContain(key);
      expect(params()[2]).toBe(key);
    });

    test("a non-object containment value does not throw", async () => {
      await expect(
        custom(JsonbStore).similaritySearchVectorWithScore([0.1], 5, {
          profile: { jsonbContains: "gold" },
        } as unknown as MetadataFilter)
      ).resolves.toBeDefined();
      // Bound as data, so Postgres decides what to do with it.
      expect(params()[3]).toBe('"gold"');
    });

    test("an unknown operator still warns alongside a subclass operator", async () => {
      await custom(JsonbStore).similaritySearchVectorWithScore([0.1], 5, {
        profile: { jsonbContains: { tier: "gold" } },
        category: { exists: true },
      } as unknown as MetadataFilter);

      // The base class owns `category`, so it still reports it. The subclass
      // operator must not silence diagnostics for keys it does not own.
      expect(warnings()).toHaveLength(1);
      expect(warnings()[0]).toContain("category.exists");
      expect(sql()).toContain("@> $");
    });

    test("an empty operator object still warns", async () => {
      await expect(
        custom(JsonbStore).similaritySearchVectorWithScore([0.1], 5, {
          profile: {},
          score: { gte: 1 },
        } as unknown as MetadataFilter)
      ).resolves.toBeDefined();
      expect(warnings()).toHaveLength(1);
      expect(warnings()[0]).toContain("profile");
    });

    test("an empty in list is still short-circuited by the base class", async () => {
      await custom(JsonbStore).similaritySearchVectorWithScore([0.1], 5, {
        profile: { jsonbContains: { tier: "gold" } },
        kind: { in: [] },
      } as unknown as MetadataFilter);

      expect(sql()).toContain("FALSE");
      expect(warnings()).toHaveLength(0);
    });
  });
});
