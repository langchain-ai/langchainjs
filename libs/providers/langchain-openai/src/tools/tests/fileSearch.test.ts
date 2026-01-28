import { expect, it, describe } from "vitest";
import { tools } from "../index.js";

describe("OpenAI File Search Tool Tests", () => {
  it("fileSearch creates a basic tool with vector store IDs", () => {
    expect(
      tools.fileSearch({
        vectorStoreIds: ["vs_abc123"],
      })
    ).toMatchInlineSnapshot(`
      {
        "filters": undefined,
        "max_num_results": undefined,
        "ranking_options": undefined,
        "type": "file_search",
        "vector_store_ids": [
          "vs_abc123",
        ],
      }
    `);
  });

  it("fileSearch creates tool with multiple vector stores", () => {
    expect(
      tools.fileSearch({
        vectorStoreIds: ["vs_abc123", "vs_def456", "vs_ghi789"],
      })
    ).toMatchInlineSnapshot(`
      {
        "filters": undefined,
        "max_num_results": undefined,
        "ranking_options": undefined,
        "type": "file_search",
        "vector_store_ids": [
          "vs_abc123",
          "vs_def456",
          "vs_ghi789",
        ],
      }
    `);
  });

  it("fileSearch creates tool with max results limit", () => {
    expect(
      tools.fileSearch({
        vectorStoreIds: ["vs_abc123"],
        maxNumResults: 5,
      })
    ).toMatchInlineSnapshot(`
      {
        "filters": undefined,
        "max_num_results": 5,
        "ranking_options": undefined,
        "type": "file_search",
        "vector_store_ids": [
          "vs_abc123",
        ],
      }
    `);
  });

  it("fileSearch creates tool with comparison filter", () => {
    expect(
      tools.fileSearch({
        vectorStoreIds: ["vs_abc123"],
        filters: {
          type: "eq",
          key: "category",
          value: "blog",
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "filters": {
          "key": "category",
          "type": "eq",
          "value": "blog",
        },
        "max_num_results": undefined,
        "ranking_options": undefined,
        "type": "file_search",
        "vector_store_ids": [
          "vs_abc123",
        ],
      }
    `);
  });

  it("fileSearch creates tool with compound filter (AND)", () => {
    expect(
      tools.fileSearch({
        vectorStoreIds: ["vs_abc123"],
        filters: {
          type: "and",
          filters: [
            { type: "eq", key: "category", value: "technical" },
            { type: "gte", key: "year", value: 2024 },
          ],
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "filters": {
          "filters": [
            {
              "key": "category",
              "type": "eq",
              "value": "technical",
            },
            {
              "key": "year",
              "type": "gte",
              "value": 2024,
            },
          ],
          "type": "and",
        },
        "max_num_results": undefined,
        "ranking_options": undefined,
        "type": "file_search",
        "vector_store_ids": [
          "vs_abc123",
        ],
      }
    `);
  });

  it("fileSearch creates tool with compound filter (OR)", () => {
    expect(
      tools.fileSearch({
        vectorStoreIds: ["vs_abc123"],
        filters: {
          type: "or",
          filters: [
            { type: "eq", key: "category", value: "blog" },
            { type: "eq", key: "category", value: "announcement" },
          ],
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "filters": {
          "filters": [
            {
              "key": "category",
              "type": "eq",
              "value": "blog",
            },
            {
              "key": "category",
              "type": "eq",
              "value": "announcement",
            },
          ],
          "type": "or",
        },
        "max_num_results": undefined,
        "ranking_options": undefined,
        "type": "file_search",
        "vector_store_ids": [
          "vs_abc123",
        ],
      }
    `);
  });

  it("fileSearch creates tool with ranking options", () => {
    expect(
      tools.fileSearch({
        vectorStoreIds: ["vs_abc123"],
        rankingOptions: {
          ranker: "auto",
          scoreThreshold: 0.8,
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "filters": undefined,
        "max_num_results": undefined,
        "ranking_options": {
          "hybrid_search": undefined,
          "ranker": "auto",
          "score_threshold": 0.8,
        },
        "type": "file_search",
        "vector_store_ids": [
          "vs_abc123",
        ],
      }
    `);
  });

  it("fileSearch creates tool with hybrid search weights", () => {
    expect(
      tools.fileSearch({
        vectorStoreIds: ["vs_abc123"],
        rankingOptions: {
          hybridSearch: {
            embeddingWeight: 0.7,
            textWeight: 0.3,
          },
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "filters": undefined,
        "max_num_results": undefined,
        "ranking_options": {
          "hybrid_search": {
            "embedding_weight": 0.7,
            "text_weight": 0.3,
          },
          "ranker": undefined,
          "score_threshold": undefined,
        },
        "type": "file_search",
        "vector_store_ids": [
          "vs_abc123",
        ],
      }
    `);
  });

  it("fileSearch creates tool with all options", () => {
    expect(
      tools.fileSearch({
        vectorStoreIds: ["vs_abc123", "vs_def456"],
        maxNumResults: 10,
        filters: {
          type: "eq",
          key: "status",
          value: "published",
        },
        rankingOptions: {
          ranker: "default-2024-11-15",
          scoreThreshold: 0.75,
          hybridSearch: {
            embeddingWeight: 0.6,
            textWeight: 0.4,
          },
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "filters": {
          "key": "status",
          "type": "eq",
          "value": "published",
        },
        "max_num_results": 10,
        "ranking_options": {
          "hybrid_search": {
            "embedding_weight": 0.6,
            "text_weight": 0.4,
          },
          "ranker": "default-2024-11-15",
          "score_threshold": 0.75,
        },
        "type": "file_search",
        "vector_store_ids": [
          "vs_abc123",
          "vs_def456",
        ],
      }
    `);
  });

  it("fileSearch supports all comparison operators", () => {
    const operators = ["eq", "ne", "gt", "gte", "lt", "lte"] as const;

    for (const op of operators) {
      const tool = tools.fileSearch({
        vectorStoreIds: ["vs_abc123"],
        filters: {
          type: op,
          key: "count",
          value: 100,
        },
      });
      expect(tool.type).toBe("file_search");
      expect(tool.filters).toEqual({
        type: op,
        key: "count",
        value: 100,
      });
    }
  });
});
