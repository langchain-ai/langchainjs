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

function createMockPool() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    connect: vi.fn().mockResolvedValue({ release: vi.fn() }),
    end: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * A minimal subclass that supplies one extra operator. It exists only to prove
 * that `buildFilterClauses` is overridable; the repository does not ship a
 * JSONB containment operator.
 */
class JsonbStore extends PGVectorStore {
  protected override buildFilterClauses(
    filter: MetadataFilter,
    paramOffset = 0
  ) {
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
      // Strip the operator before delegating, or the base implementation
      // warns about it.
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

describe("buildFilterClauses is overridable", () => {
  let pool: ReturnType<typeof createMockPool>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    pool = createMockPool();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  const create = <T extends PGVectorStore>(
    Cls: new (embeddings: EmbeddingsInterface, config: PGVectorStoreArgs) => T,
    config: Partial<PGVectorStoreArgs> = {}
  ) =>
    new Cls(new MockEmbeddings(), {
      tableName: "test_table",
      pool: pool as unknown as Pool,
      ...config,
    });

  const sql = () => pool.query.mock.calls[0][0] as string;
  const params = () => pool.query.mock.calls[0][1] as unknown[];

  test("a subclass operator reaches the query", async () => {
    await create(JsonbStore).similaritySearchVectorWithScore([0.1], 5, {
      profile: { jsonbContains: { tier: "gold" } },
    } as unknown as MetadataFilter);

    expect(sql()).toContain("(metadata -> $3) @> $4::jsonb");
    expect(params().slice(2)).toEqual(["profile", '{"tier":"gold"}']);
  });

  test("the override keeps parameter numbering contiguous with base operators", async () => {
    await create(JsonbStore).similaritySearchVectorWithScore([0.1], 5, {
      profile: { jsonbContains: { tier: "gold" } },
      score: { gte: 50 },
    } as unknown as MetadataFilter);

    const referenced = [
      ...new Set([...sql().matchAll(/\$(\d+)/g)].map((m) => Number(m[1]))),
    ].sort((a, b) => a - b);
    // $1 embedding, $2 limit, $3-$4 containment, $5-$6 gte.
    expect(referenced).toEqual([1, 2, 3, 4, 5, 6]);
    expect(params()).toHaveLength(6);
  });

  test("paramOffset accounts for a collection id", async () => {
    const collPool = {
      query: vi.fn().mockResolvedValue({ rows: [{ uuid: "coll-uuid" }] }),
      connect: vi.fn().mockResolvedValue({ release: vi.fn() }),
      end: vi.fn().mockResolvedValue(undefined),
    };
    const store = new JsonbStore(new MockEmbeddings(), {
      tableName: "test_table",
      pool: collPool as unknown as Pool,
      collectionTableName: "collections",
    });

    await store.similaritySearchVectorWithScore([0.1], 5, {
      profile: { jsonbContains: { tier: "gold" } },
    } as unknown as MetadataFilter);

    const querySql = collPool.query.mock.calls.at(-1)?.[0] as string;
    expect(querySql).toContain("collection_id = $3");
    expect(querySql).toContain("(metadata -> $4) @> $5::jsonb");
  });

  test("an override that strips its operator does not trigger the warning", async () => {
    await create(JsonbStore).similaritySearchVectorWithScore([0.1], 5, {
      profile: { jsonbContains: { tier: "gold" } },
    } as unknown as MetadataFilter);

    expect(warnSpy).not.toHaveBeenCalled();
  });

  test("the base store still has no containment operator", async () => {
    await create(PGVectorStore).similaritySearchVectorWithScore([0.1], 5, {
      profile: { jsonbContains: { tier: "gold" } },
    } as unknown as MetadataFilter);

    expect(sql()).not.toContain("@>");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain("profile.jsonbContains");
  });
});
