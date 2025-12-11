import { describe, test, expect, beforeEach } from "vitest";

import {
  AzureCosmosDBNoSQLVectorStore,
  AzureCosmosDBNoSQLSearchType,
} from "../azure_cosmosdb_nosql.js";
import { FakeEmbeddings } from "@langchain/core/utils/testing";
import {
  VectorEmbeddingDataType,
  VectorEmbeddingDistanceFunction,
  VectorIndexType,
} from "@azure/cosmos";

/**
 * Comprehensive test suite for Azure Cosmos DB NoSQL query building functionality.
 * This test file covers all query types, search scenarios, and edge cases.
 */
describe("AzureCosmosDBNoSQLVectorStore - Comprehensive Query Building Tests", () => {
  let vectorStore: AzureCosmosDBNoSQLVectorStore;
  //let mockContainer: any;

  beforeEach(() => {
    const fakeEmbeddings = new FakeEmbeddings();

    vectorStore = new AzureCosmosDBNoSQLVectorStore(fakeEmbeddings, {
      connectionString:
        "AccountEndpoint=https://test.documents.azure.com:443/;AccountKey=testKey123==;",
      databaseName: "testDB",
      containerName: "testContainer",
      textKey: "content",
      metadataKey: "metadata",
      tableAlias: "c",
      vectorEmbeddingPolicy: {
        vectorEmbeddings: [
          {
            path: "/embedding",
            dataType: VectorEmbeddingDataType.Float32,
            distanceFunction: VectorEmbeddingDistanceFunction.Cosine,
            dimensions: 1536,
          },
        ],
      },
      indexingPolicy: {
        indexingMode: "consistent",
        automatic: true,
        includedPaths: [{ path: "/*" }],
        excludedPaths: [{ path: "/_etag/?" }],
        vectorIndexes: [
          {
            path: "/embedding",
            type: VectorIndexType.QuantizedFlat,
          },
        ],
      },
    });
    (vectorStore as any).initPromise = Promise.resolve();
  });

  describe("Query Type: Vector Similarity Search", () => {
    test("should construct basic vector search query", () => {
      const embeddings = [0.1, 0.2, 0.3, 0.4];
      const k = 5;

      const result = (vectorStore as any).constructQuery(
        k,
        AzureCosmosDBNoSQLSearchType.Vector,
        { embeddings }
      );
      console.log(result);

      expect(result.query).toMatch(/SELECT TOP @limit/);
      expect(result.query).toMatch(/FROM c/);
      expect(result.query).toMatch(
        /ORDER BY VectorDistance\(c\[@embeddingKey\], @embeddings\)/
      );
      expect(result.parameters).toContainEqual({ name: "@limit", value: k });
      expect(result.parameters).toContainEqual({
        name: "@embeddings",
        value: embeddings,
      });
    });

    test("should apply filterClause as string for filtering", () => {
      const embeddings = [0.1, 0.2, 0.3];
      const filterClause =
        "WHERE c.category = 'electronics' AND c.price < 1000";

      const result = (vectorStore as any).constructQuery(
        5,
        AzureCosmosDBNoSQLSearchType.Vector,
        { embeddings, filterClause }
      );

      console.log(result);

      expect(result.query).toContain(filterClause);
      expect(result.query.indexOf("WHERE")).toBeLessThan(
        result.query.indexOf("ORDER BY")
      );
    });

    test("should apply filterClause as SqlQuerySpec with parameters", () => {
      const embeddings = [0.1, 0.2, 0.3];
      const filterClause = {
        query: "WHERE c.category = @category AND c.price < @maxPrice",
        parameters: [
          { name: "@category", value: "electronics" },
          { name: "@maxPrice", value: 1000 },
        ],
      };

      const result = (vectorStore as any).constructQuery(
        5,
        AzureCosmosDBNoSQLSearchType.Vector,
        { embeddings, filterClause }
      );

      console.log(result);

      expect(result.query).toContain(filterClause.query);
      expect(result.parameters).toContainEqual({
        name: "@category",
        value: "electronics",
      });
      expect(result.parameters).toContainEqual({
        name: "@maxPrice",
        value: 1000,
      });
      expect(result.query.indexOf("WHERE")).toBeLessThan(
        result.query.indexOf("ORDER BY")
      );
    });

    test("should include embeddings in projection when requested", () => {
      const embeddings = [0.1, 0.2, 0.3];

      const result = (vectorStore as any).constructQuery(
        5,
        AzureCosmosDBNoSQLSearchType.Vector,
        { embeddings, withEmbedding: true }
      );
      console.log(result);

      expect(result.query).toContain("c[@embeddingKey] as embedding");
      expect(result.query).toContain(
        "VectorDistance(c[@embeddingKey], @embeddings) as SimilarityScore"
      );
    });

    test("should exclude embeddings from projection by default", () => {
      const embeddings = [0.1, 0.2, 0.3];

      const result = (vectorStore as any).constructQuery(
        5,
        AzureCosmosDBNoSQLSearchType.Vector,
        { embeddings, withEmbedding: false }
      );

      expect(result.query).not.toContain("c[@embeddingKey] as embedding");
      expect(result.query).toContain(
        "VectorDistance(c[@embeddingKey], @embeddings) as SimilarityScore"
      );
    });

    test("should apply custom offset and limit pagination", () => {
      const embeddings = [0.1, 0.2, 0.3];
      const offsetLimit = "OFFSET 10 LIMIT 20";

      const result = (vectorStore as any).constructQuery(
        20,
        AzureCosmosDBNoSQLSearchType.Vector,
        { embeddings, offsetLimit }
      );

      console.log(result);

      expect(result.query).not.toContain("TOP @limit");
      expect(result.query).toContain(offsetLimit);
    });

    test("should use custom projection mapping", () => {
      const embeddings = [0.1, 0.2, 0.3];
      const projectionMapping = {
        title: "productTitle",
        price: "productPrice",
        category: "productCategory",
      };

      const result = (vectorStore as any).constructQuery(
        5,
        AzureCosmosDBNoSQLSearchType.Vector,
        { embeddings, projectionMapping }
      );

      console.log(result);

      expect(result.query).toContain("c[@title] as productTitle");
      expect(result.query).toContain("c[@price] as productPrice");
      expect(result.query).toContain("c[@category] as productCategory");
    });

    test("should handle vector search with all options combined", () => {
      const embeddings = [0.1, 0.2, 0.3];
      const filterClause = "WHERE c.status = 'active'";
      const offsetLimit = "OFFSET 5 LIMIT 15";
      const projectionMapping = { title: "name", price: "cost" };

      const result = (vectorStore as any).constructQuery(
        15,
        AzureCosmosDBNoSQLSearchType.Vector,
        {
          embeddings,
          filterClause,
          offsetLimit,
          projectionMapping,
          withEmbedding: true,
        }
      );

      console.log(result);

      expect(result.query).toContain(`${filterClause}`);
      expect(result.query).toContain(offsetLimit);
      expect(result.query).toContain("c[@title] as name");
      expect(result.query).toContain("c[@price] as cost");
      expect(result.query).not.toContain("TOP @limit");
    });
  });

  describe("Query Type: Vector Search with Score Threshold", () => {
    test("should construct vector threshold query", () => {
      const embeddings = [0.1, 0.2, 0.3];
      const k = 10;

      const result = (vectorStore as any).constructQuery(
        k,
        AzureCosmosDBNoSQLSearchType.VectorScoreThreshold,
        { embeddings }
      );

      console.log(result);

      expect(result.query).toContain("SELECT TOP @limit");
      expect(result.query).toContain(
        "ORDER BY VectorDistance(c[@embeddingKey], @embeddings)"
      );
      expect(result.parameters).toContainEqual({ name: "@limit", value: k });
      expect(result.parameters).toContainEqual({
        name: "@embeddings",
        value: embeddings,
      });
    });

    test("should construct threshold query with filterClause and pagination", () => {
      const embeddings = [0.1, 0.2, 0.3];
      const filterClause = "WHERE c.verified = true";
      const offsetLimit = "OFFSET 0 LIMIT 50";

      const result = (vectorStore as any).constructQuery(
        50,
        AzureCosmosDBNoSQLSearchType.VectorScoreThreshold,
        { embeddings, filterClause, offsetLimit }
      );

      console.log(result);

      expect(result.query).toContain(filterClause);
      expect(result.query).toContain(offsetLimit);
      expect(result.query).not.toContain("TOP @limit");
    });

    describe("Query Type: Full-Text Search", () => {
      test("should construct full-text search query without ranking", () => {
        const k = 5;

        const result = (vectorStore as any).constructQuery(
          k,
          AzureCosmosDBNoSQLSearchType.FullTextSearch,
          {}
        );

        console.log(result);

        expect(result.query).toContain("SELECT TOP @limit");
        expect(result.query).toContain("FROM c");
        expect(result.query).not.toContain("VectorDistance");
        expect(result.query).not.toContain("ORDER BY");
      });

      test("should apply filterClause to full-text search", () => {
        const filterClause = "WHERE c.published = true AND c.language = 'en'";

        const result = (vectorStore as any).constructQuery(
          10,
          AzureCosmosDBNoSQLSearchType.FullTextSearch,
          { filterClause }
        );

        console.log(result);

        expect(result.query).toContain(`${filterClause}`);
      });

      test("should use projection mapping for full-text search", () => {
        const projectionMapping = {
          title: "articleTitle",
          author: "writer",
        };

        const result = (vectorStore as any).constructQuery(
          5,
          AzureCosmosDBNoSQLSearchType.FullTextSearch,
          { projectionMapping }
        );

        console.log(result);

        expect(result.query).toContain("c[@title] as articleTitle");
        expect(result.query).toContain("c[@author] as writer");
      });

      test("should apply pagination to full-text search", () => {
        const offsetLimit = "OFFSET 20 LIMIT 10";

        const result = (vectorStore as any).constructQuery(
          10,
          AzureCosmosDBNoSQLSearchType.FullTextSearch,
          { offsetLimit }
        );

        console.log(result);

        expect(result.query).toContain(offsetLimit);
        expect(result.query).not.toContain("TOP @limit");
      });
    });

    describe("Query Type: Full-Text Ranking", () => {
      test("should construct ranking query with single search field", () => {
        const fullTextRankFilter = [
          {
            searchField: "description",
            searchText: "machine learning artificial intelligence",
          },
        ];

        const result = (vectorStore as any).constructQuery(
          5,
          AzureCosmosDBNoSQLSearchType.FullTextRanking,
          { fullTextRankFilter }
        );

        console.log(result);

        expect(result.query).toContain(
          "ORDER BY RANK FullTextScore(c[@description]"
        );
        expect(result.parameters).toContainEqual({
          name: "@description_term_0",
          value: "machine",
        });
        expect(result.parameters).toContainEqual({
          name: "@description_term_1",
          value: "learning",
        });
        expect(result.parameters).toContainEqual({
          name: "@description_term_2",
          value: "artificial",
        });
        expect(result.parameters).toContainEqual({
          name: "@description_term_3",
          value: "intelligence",
        });
      });

      test("should construct ranking query with multiple search fields using RRF", () => {
        const fullTextRankFilter = [
          {
            searchField: "title",
            searchText: "cosmos database",
          },
          {
            searchField: "description",
            searchText: "nosql vector search",
          },
          {
            searchField: "tags",
            searchText: "azure cloud",
          },
        ];

        const result = (vectorStore as any).constructQuery(
          10,
          AzureCosmosDBNoSQLSearchType.FullTextRanking,
          { fullTextRankFilter }
        );

        console.log(result);

        expect(result.query).toContain("ORDER BY RANK RRF(");
        expect(result.query).toContain("FullTextScore(c[@title]");
        expect(result.query).toContain("FullTextScore(c[@description]");
        expect(result.query).toContain("FullTextScore(c[@tags]");
        expect(result.parameters).toContainEqual({
          name: "@title_term_0",
          value: "cosmos",
        });
        expect(result.parameters).toContainEqual({
          name: "@description_term_1",
          value: "vector",
        });
        expect(result.parameters).toContainEqual({
          name: "@tags_term_0",
          value: "azure",
        });
      });

      test("should include searched fields in projection", () => {
        const fullTextRankFilter = [
          {
            searchField: "title",
            searchText: "search",
          },
          {
            searchField: "body",
            searchText: "content",
          },
        ];

        const result = (vectorStore as any).constructQuery(
          5,
          AzureCosmosDBNoSQLSearchType.FullTextRanking,
          { fullTextRankFilter }
        );

        console.log(result);

        expect(result.query).toContain("c[@title] as title");
        expect(result.query).toContain("c[@body] as body");
      });

      test("should combine ranking with filterClause", () => {
        const fullTextRankFilter = [
          {
            searchField: "content",
            searchText: "search query",
          },
        ];
        const filterClause = "WHERE c.category = 'documentation'";

        const result = (vectorStore as any).constructQuery(
          5,
          AzureCosmosDBNoSQLSearchType.FullTextRanking,
          { fullTextRankFilter, filterClause }
        );

        console.log(result);

        expect(result.query).toContain(`${filterClause}`);
        expect(result.query).toContain("ORDER BY RANK");
      });

      test("should support custom projection with ranking", () => {
        const fullTextRankFilter = [
          {
            searchField: "content",
            searchText: "test",
          },
        ];
        const projectionMapping = {
          content: "text",
          author: "creator",
          timestamp: "date",
        };

        const result = (vectorStore as any).constructQuery(
          5,
          AzureCosmosDBNoSQLSearchType.FullTextRanking,
          { fullTextRankFilter, projectionMapping }
        );

        console.log(result);

        expect(result.query).toContain("c[@content] as text");
        expect(result.query).toContain("c[@author] as creator");
        expect(result.query).toContain("c[@timestamp] as date");
      });
    });

    describe("Query Type: Hybrid Search", () => {
      test("should construct hybrid query with vector and single full-text field", () => {
        const embeddings = [0.1, 0.2, 0.3];
        const fullTextRankFilter = [
          {
            searchField: "description",
            searchText: "vector database search",
          },
        ];

        const result = (vectorStore as any).constructQuery(
          5,
          AzureCosmosDBNoSQLSearchType.Hybrid,
          { embeddings, fullTextRankFilter }
        );

        console.log(result);

        expect(result.query).toContain("ORDER BY RANK RRF(");
        expect(result.query).toContain("FullTextScore(c[@description]");
        expect(result.query).toContain(
          "VectorDistance(c[@embeddingKey], @embeddings)"
        );
        expect(result.query).toMatch(/\)$/); // Should end with closing parenthesis
      });

      test("should construct hybrid query with multiple full-text fields", () => {
        const embeddings = [0.1, 0.2, 0.3];
        const fullTextRankFilter = [
          {
            searchField: "title",
            searchText: "azure cosmos",
          },
          {
            searchField: "description",
            searchText: "nosql database",
          },
          {
            searchField: "tags",
            searchText: "vector search",
          },
        ];

        const result = (vectorStore as any).constructQuery(
          5,
          AzureCosmosDBNoSQLSearchType.Hybrid,
          { embeddings, fullTextRankFilter }
        );

        console.log(result);

        expect(result.query).toContain("ORDER BY RANK RRF(");
        expect(result.query).toContain("FullTextScore(c[@title]");
        expect(result.query).toContain("FullTextScore(c[@description]");
        expect(result.query).toContain("FullTextScore(c[@tags]");
        expect(result.query).toContain(
          "VectorDistance(c[@embeddingKey], @embeddings)"
        );
      });

      test("should include weights in hybrid query when provided", () => {
        const embeddings = [0.1, 0.2, 0.3];
        const fullTextRankFilter = [
          {
            searchField: "content",
            searchText: "search",
          },
        ];
        const weights = [0.6, 0.4];

        const result = (vectorStore as any).constructQuery(
          5,
          AzureCosmosDBNoSQLSearchType.Hybrid,
          { embeddings, fullTextRankFilter, weights }
        );

        console.log(result);

        expect(result.query).toContain(", @weights)");
        expect(result.parameters).toContainEqual({
          name: "@weights",
          value: weights,
        });
      });

      test("should not include weights when not provided", () => {
        const embeddings = [0.1, 0.2, 0.3];
        const fullTextRankFilter = [
          {
            searchField: "content",
            searchText: "search",
          },
        ];

        const result = (vectorStore as any).constructQuery(
          5,
          AzureCosmosDBNoSQLSearchType.Hybrid,
          { embeddings, fullTextRankFilter }
        );

        console.log(result);

        expect(result.query).not.toContain("@weights");
        expect(result.query).toMatch(/\)$/);
      });

      test("should include embeddings in projection for hybrid search", () => {
        const embeddings = [0.1, 0.2, 0.3];
        const fullTextRankFilter = [
          {
            searchField: "text",
            searchText: "query",
          },
        ];

        const result = (vectorStore as any).constructQuery(
          5,
          AzureCosmosDBNoSQLSearchType.Hybrid,
          { embeddings, fullTextRankFilter, withEmbedding: true }
        );

        console.log(result);
        expect(result.query).toContain("c[@embeddingKey] as embedding");
        expect(result.query).toContain(
          "VectorDistance(c[@embeddingKey], @embeddings) as SimilarityScore"
        );
      });

      test("should combine hybrid search with all filter options", () => {
        const embeddings = [0.1, 0.2, 0.3];
        const fullTextRankFilter = [
          {
            searchField: "title",
            searchText: "product",
          },
          {
            searchField: "description",
            searchText: "quality",
          },
        ];
        const filterClause = "WHERE c.inStock = true AND c.price < 500";
        const offsetLimit = "OFFSET 10 LIMIT 30";
        const weights = [0.3, 0.4, 0.3];

        const result = (vectorStore as any).constructQuery(
          30,
          AzureCosmosDBNoSQLSearchType.Hybrid,
          {
            embeddings,
            fullTextRankFilter,
            filterClause,
            offsetLimit,
            weights,
            withEmbedding: true,
          }
        );

        console.log(result);
        expect(result.query).toContain(`${filterClause}`);
        expect(result.query).toContain(offsetLimit);
        expect(result.query).toContain("@weights");
        expect(result.query).toContain("c[@embeddingKey] as embedding");
        expect(result.query).not.toContain("TOP @limit");
      });
    });

    describe("Query Type: Hybrid Search with Score Threshold", () => {
      test("should construct hybrid threshold query", () => {
        const embeddings = [0.1, 0.2, 0.3];
        const fullTextRankFilter = [
          {
            searchField: "content",
            searchText: "database search",
          },
        ];

        const result = (vectorStore as any).constructQuery(
          5,
          AzureCosmosDBNoSQLSearchType.HybridScoreThreshold,
          { embeddings, fullTextRankFilter }
        );

        console.log(result);
        expect(result.query).toContain("ORDER BY RANK RRF(");
        expect(result.query).toContain("FullTextScore");
        expect(result.query).toContain("VectorDistance");
      });

      test("should include weights in hybrid threshold query", () => {
        const embeddings = [0.1, 0.2, 0.3];
        const fullTextRankFilter = [
          {
            searchField: "title",
            searchText: "search",
          },
        ];
        const weights = [0.5, 0.5];

        const result = (vectorStore as any).constructQuery(
          5,
          AzureCosmosDBNoSQLSearchType.HybridScoreThreshold,
          { embeddings, fullTextRankFilter, weights }
        );

        console.log(result);
        expect(result.query).toContain(", @weights)");
        expect(result.parameters).toContainEqual({
          name: "@weights",
          value: weights,
        });
      });

      test("should combine threshold with projection mapping", () => {
        const embeddings = [0.1, 0.2, 0.3];
        const fullTextRankFilter = [
          {
            searchField: "description",
            searchText: "test query",
          },
        ];
        const projectionMapping = {
          title: "name",
          price: "cost",
        };

        const result = (vectorStore as any).constructQuery(
          5,
          AzureCosmosDBNoSQLSearchType.HybridScoreThreshold,
          {
            embeddings,
            fullTextRankFilter,
            projectionMapping,
            withEmbedding: true,
          }
        );

        console.log(result);

        expect(result.query).toContain("c[@title] as name");
        expect(result.query).toContain("c[@price] as cost");
      });
    });

    describe("Parameter Building", () => {
      test("should build correct parameters for vector search", () => {
        const embeddings = [0.1, 0.2, 0.3, 0.4, 0.5];
        const k = 7;

        const result = (vectorStore as any).constructQuery(
          k,
          AzureCosmosDBNoSQLSearchType.Vector,
          { embeddings }
        );

        console.log(result);
        expect(result.parameters).toContainEqual({ name: "@limit", value: k });
        expect(result.parameters).toContainEqual({
          name: "@textKey",
          value: "content",
        });
        expect(result.parameters).toContainEqual({
          name: "@metadataKey",
          value: "metadata",
        });
        expect(result.parameters).toContainEqual({
          name: "@embeddingKey",
          value: "embedding",
        });
        expect(result.parameters).toContainEqual({
          name: "@embeddings",
          value: embeddings,
        });
      });

      test("should build parameters with projection mapping", () => {
        const embeddings = [0.1, 0.2, 0.3];
        const projectionMapping = {
          field1: "alias1",
          field2: "alias2",
          field3: "alias3",
        };

        const result = (vectorStore as any).constructQuery(
          5,
          AzureCosmosDBNoSQLSearchType.Vector,
          { embeddings, projectionMapping }
        );

        console.log(result);
        expect(result.parameters).toContainEqual({
          name: "@field1",
          value: "field1",
        });
        expect(result.parameters).toContainEqual({
          name: "@field2",
          value: "field2",
        });
        expect(result.parameters).toContainEqual({
          name: "@field3",
          value: "field3",
        });
        expect(result.parameters).not.toContainEqual(
          expect.objectContaining({ name: "@textKey" })
        );
      });

      test("should build parameters for full-text search with complex text", () => {
        const fullTextRankFilter = [
          {
            searchField: "title",
            searchText: "azure cosmos db nosql vector search",
          },
        ];

        const result = (vectorStore as any).constructQuery(
          5,
          AzureCosmosDBNoSQLSearchType.FullTextRanking,
          { fullTextRankFilter }
        );

        console.log(result);
        expect(result.parameters).toContainEqual({
          name: "@title",
          value: "title",
        });
        expect(result.parameters).toContainEqual({
          name: "@title_term_0",
          value: "azure",
        });
        expect(result.parameters).toContainEqual({
          name: "@title_term_1",
          value: "cosmos",
        });
        expect(result.parameters).toContainEqual({
          name: "@title_term_2",
          value: "db",
        });
        expect(result.parameters).toContainEqual({
          name: "@title_term_3",
          value: "nosql",
        });
        expect(result.parameters).toContainEqual({
          name: "@title_term_4",
          value: "vector",
        });
        expect(result.parameters).toContainEqual({
          name: "@title_term_5",
          value: "search",
        });
      });

      test("should build parameters for multiple full-text fields", () => {
        const fullTextRankFilter = [
          {
            searchField: "title",
            searchText: "first second",
          },
          {
            searchField: "body",
            searchText: "third fourth fifth",
          },
        ];

        const result = (vectorStore as any).constructQuery(
          5,
          AzureCosmosDBNoSQLSearchType.FullTextRanking,
          { fullTextRankFilter }
        );

        console.log(result);
        expect(result.parameters).toContainEqual({
          name: "@title_term_0",
          value: "first",
        });
        expect(result.parameters).toContainEqual({
          name: "@title_term_1",
          value: "second",
        });
        expect(result.parameters).toContainEqual({
          name: "@body_term_0",
          value: "third",
        });
        expect(result.parameters).toContainEqual({
          name: "@body_term_1",
          value: "fourth",
        });
        expect(result.parameters).toContainEqual({
          name: "@body_term_2",
          value: "fifth",
        });
      });

      test("should include weights parameter when provided", () => {
        const embeddings = [0.1, 0.2, 0.3];
        const fullTextRankFilter = [
          {
            searchField: "content",
            searchText: "test",
          },
        ];
        const weights = [0.8, 0.2];

        const result = (vectorStore as any).constructQuery(
          5,
          AzureCosmosDBNoSQLSearchType.Hybrid,
          { embeddings, fullTextRankFilter, weights }
        );

        console.log(result);
        expect(result.parameters).toContainEqual({
          name: "@weights",
          value: weights,
        });
      });

      test("should not include weights parameter when not provided", () => {
        const embeddings = [0.1, 0.2, 0.3];
        const fullTextRankFilter = [
          {
            searchField: "content",
            searchText: "test",
          },
        ];

        const result = (vectorStore as any).constructQuery(
          5,
          AzureCosmosDBNoSQLSearchType.Hybrid,
          { embeddings, fullTextRankFilter }
        );

        console.log(result);
        const paramNames = result.parameters.map((p: any) => p.name);
        expect(paramNames).not.toContain("@weights");
      });
    });

    describe("Projection Field Generation", () => {
      test("should generate default projection for vector search", () => {
        const projection = (vectorStore as any).generateProjectionFields(
          AzureCosmosDBNoSQLSearchType.Vector,
          undefined,
          undefined,
          false
        );
        console.log(projection);
        expect(projection).toContain("c.id");
        expect(projection).toContain("c[@textKey] as content");
        expect(projection).toContain("c[@metadataKey] as metadata");
        expect(projection).toContain(
          "VectorDistance(c[@embeddingKey], @embeddings) as SimilarityScore"
        );
        expect(projection).not.toContain("c[@embeddingKey] as embedding");
      });

      test("should include embedding field when withEmbedding is true", () => {
        const projection = (vectorStore as any).generateProjectionFields(
          AzureCosmosDBNoSQLSearchType.Vector,
          undefined,
          undefined,
          true
        );
        console.log(projection);
        expect(projection).toContain("c[@embeddingKey] as embedding");
        expect(projection).toContain(
          "VectorDistance(c[@embeddingKey], @embeddings) as SimilarityScore"
        );
      });

      test("should generate custom projection from mapping", () => {
        const projectionMapping = {
          productId: "id",
          productName: "name",
          productPrice: "price",
          productCategory: "category",
        };

        const projection = (vectorStore as any).generateProjectionFields(
          AzureCosmosDBNoSQLSearchType.Vector,
          projectionMapping,
          undefined,
          false
        );
        console.log(projection);
        expect(projection).toContain("c[@productId] as id");
        expect(projection).toContain("c[@productName] as name");
        expect(projection).toContain("c[@productPrice] as price");
        expect(projection).toContain("c[@productCategory] as category");
      });

      test("should generate projection for full-text search fields", () => {
        const fullTextRankFilter = [
          {
            searchField: "title",
            searchText: "search",
          },
          {
            searchField: "description",
            searchText: "text",
          },
          {
            searchField: "tags",
            searchText: "metadata",
          },
        ];

        const projection = (vectorStore as any).generateProjectionFields(
          AzureCosmosDBNoSQLSearchType.FullTextRanking,
          undefined,
          fullTextRankFilter,
          false
        );
        console.log(projection);
        expect(projection).toContain("c.id");
        expect(projection).toContain("c[@title] as title");
        expect(projection).toContain("c[@description] as description");
        expect(projection).toContain("c[@tags] as tags");
      });

      test("should not include SimilarityScore for full-text only search", () => {
        const fullTextRankFilter = [
          {
            searchField: "content",
            searchText: "test",
          },
        ];

        const projection = (vectorStore as any).generateProjectionFields(
          AzureCosmosDBNoSQLSearchType.FullTextSearch,
          undefined,
          fullTextRankFilter,
          false
        );
        console.log(projection);
        expect(projection).not.toContain("VectorDistance");
        expect(projection).not.toContain("SimilarityScore");
      });

      test("should include SimilarityScore for hybrid search", () => {
        const fullTextRankFilter = [
          {
            searchField: "content",
            searchText: "test",
          },
        ];

        const projection = (vectorStore as any).generateProjectionFields(
          AzureCosmosDBNoSQLSearchType.Hybrid,
          undefined,
          fullTextRankFilter,
          false
        );
        console.log(projection);
        expect(projection).toContain(
          "VectorDistance(c[@embeddingKey], @embeddings) as SimilarityScore"
        );
      });
    });

    describe("Edge Cases and Boundary Conditions", () => {
      test("should handle empty search text", () => {
        const fullTextRankFilter = [
          {
            searchField: "content",
            searchText: "",
          },
        ];

        const result = (vectorStore as any).constructQuery(
          5,
          AzureCosmosDBNoSQLSearchType.FullTextRanking,
          { fullTextRankFilter }
        );
        console.log(result);
        expect(result.query).toContain("ORDER BY RANK");
        expect(
          result.parameters.some((p: any) =>
            p.name.startsWith("@content_term_")
          )
        ).toBe(true);
      });

      test("should handle single word search", () => {
        const fullTextRankFilter = [
          {
            searchField: "title",
            searchText: "database",
          },
        ];

        const result = (vectorStore as any).constructQuery(
          5,
          AzureCosmosDBNoSQLSearchType.FullTextRanking,
          { fullTextRankFilter }
        );
        console.log(result);
        expect(result.parameters).toContainEqual({
          name: "@title_term_0",
          value: "database",
        });
        const termParams = result.parameters.filter((p: any) =>
          p.name.startsWith("@title_term_")
        );
        expect(termParams.length).toBe(1);
      });

      test("should handle multiple consecutive spaces in search text", () => {
        const fullTextRankFilter = [
          {
            searchField: "content",
            searchText: "word1    word2     word3",
          },
        ];

        const result = (vectorStore as any).constructQuery(
          5,
          AzureCosmosDBNoSQLSearchType.FullTextRanking,
          { fullTextRankFilter }
        );

        console.log(result);
        const termParams = result.parameters.filter((p: any) =>
          p.name.startsWith("@content_term_")
        );
        expect(termParams.length).toBeGreaterThan(0);
      });

      test("should handle k=1", () => {
        const embeddings = [0.1, 0.2, 0.3];

        const result = (vectorStore as any).constructQuery(
          1,
          AzureCosmosDBNoSQLSearchType.Vector,
          { embeddings }
        );

        console.log(result);
        expect(result.parameters).toContainEqual({ name: "@limit", value: 1 });
        expect(result.query).toContain("TOP @limit");
      });

      test("should handle large k value", () => {
        const embeddings = [0.1, 0.2, 0.3];

        const result = (vectorStore as any).constructQuery(
          10000,
          AzureCosmosDBNoSQLSearchType.Vector,
          { embeddings }
        );

        console.log(result);
        expect(result.parameters).toContainEqual({
          name: "@limit",
          value: 10000,
        });
      });

      test("should handle empty projection mapping", () => {
        const embeddings = [0.1, 0.2, 0.3];
        const projectionMapping = {};

        const result = (vectorStore as any).constructQuery(
          5,
          AzureCosmosDBNoSQLSearchType.Vector,
          { embeddings, projectionMapping }
        );

        console.log(result);
        expect(result.query).toBeDefined();
        expect(result.parameters).toBeDefined();
      });

      test("should handle very long filterClause", () => {
        const embeddings = [0.1, 0.2, 0.3];
        const filterClause =
          "c.field1 = 'value1' AND c.field2 = 'value2' AND c.field3 = 'value3' AND c.field4 > 100 AND c.field5 < 200";

        const result = (vectorStore as any).constructQuery(
          5,
          AzureCosmosDBNoSQLSearchType.Vector,
          { embeddings, filterClause }
        );

        console.log(result);
        expect(result.query).toContain(filterClause);
      });

      test("should handle special characters in search text", () => {
        const fullTextRankFilter = [
          {
            searchField: "content",
            searchText: "C++ programming & data-structures",
          },
        ];

        const result = (vectorStore as any).constructQuery(
          5,
          AzureCosmosDBNoSQLSearchType.FullTextRanking,
          { fullTextRankFilter }
        );

        console.log(result);
        expect(result.parameters).toContainEqual({
          name: "@content_term_0",
          value: "C++",
        });
        expect(result.parameters).toContainEqual({
          name: "@content_term_2",
          value: "&",
        });
        expect(result.parameters).toContainEqual({
          name: "@content_term_3",
          value: "data-structures",
        });
      });

      test("should handle zero-dimension embeddings", () => {
        const embeddings: number[] = [];

        const result = (vectorStore as any).constructQuery(
          5,
          AzureCosmosDBNoSQLSearchType.Vector,
          { embeddings }
        );

        console.log(result);
        expect(result.parameters).toContainEqual({
          name: "@embeddings",
          value: embeddings,
        });
      });

      test("should handle large dimension embeddings", () => {
        const embeddings = Array(4096)
          .fill(0)
          .map((_, i) => i / 4096);

        const result = (vectorStore as any).constructQuery(
          5,
          AzureCosmosDBNoSQLSearchType.Vector,
          { embeddings }
        );

        console.log(result);
        expect(result.parameters).toContainEqual({
          name: "@embeddings",
          value: embeddings,
        });
      });

      test("should handle maximum number of weights", () => {
        const embeddings = [0.1, 0.2, 0.3];
        const fullTextRankFilter = Array(10)
          .fill(null)
          .map((_, i) => ({
            searchField: `field${i}`,
            searchText: `text${i}`,
          }));
        const weights = Array(11).fill(1 / 11);

        const result = (vectorStore as any).constructQuery(
          5,
          AzureCosmosDBNoSQLSearchType.Hybrid,
          { embeddings, fullTextRankFilter, weights }
        );

        console.log(result);
        expect(result.parameters).toContainEqual({
          name: "@weights",
          value: weights,
        });
      });
    });

    describe("Complex filterClause Scenarios", () => {
      test("should handle complex AND/OR conditions", () => {
        const embeddings = [0.1, 0.2, 0.3];
        const filterClause =
          "WHERE (c.category = 'tech' OR c.category = 'science') AND c.published = true AND c.views > 1000";

        const result = (vectorStore as any).constructQuery(
          5,
          AzureCosmosDBNoSQLSearchType.Vector,
          { embeddings, filterClause }
        );

        console.log(result);
        expect(result.query).toContain(`${filterClause}`);
      });

      test("should handle filterClause with nested conditions", () => {
        const embeddings = [0.1, 0.2, 0.3];
        const filterClause =
          "WHERE c.metadata.nested.field = 'value' AND (c.price BETWEEN 100 AND 500)";

        const result = (vectorStore as any).constructQuery(
          5,
          AzureCosmosDBNoSQLSearchType.Vector,
          { embeddings, filterClause }
        );

        console.log(result);
        expect(result.query).toContain(`${filterClause}`);
      });

      test("should handle filterClause with IN operator", () => {
        const embeddings = [0.1, 0.2, 0.3];
        const filterClause =
          "WHERE c.category IN ('tech', 'science', 'engineering')";

        const result = (vectorStore as any).constructQuery(
          5,
          AzureCosmosDBNoSQLSearchType.Vector,
          { embeddings, filterClause }
        );

        console.log(result);
        expect(result.query).toContain(`${filterClause}`);
      });

      test("should handle filterClause with date comparisons", () => {
        const embeddings = [0.1, 0.2, 0.3];
        const filterClause =
          "WHERE c.createdAt >= '2024-01-01' AND c.updatedAt <= '2024-12-31'";

        const result = (vectorStore as any).constructQuery(
          5,
          AzureCosmosDBNoSQLSearchType.Vector,
          { embeddings, filterClause }
        );

        console.log(result);
        expect(result.query).toContain(`${filterClause}`);
      });
    });

    describe("Pagination Scenarios", () => {
      test("should handle pagination with offset 0", () => {
        const embeddings = [0.1, 0.2, 0.3];
        const offsetLimit = "OFFSET 0 LIMIT 10";

        const result = (vectorStore as any).constructQuery(
          10,
          AzureCosmosDBNoSQLSearchType.Vector,
          { embeddings, offsetLimit }
        );

        console.log(result);
        expect(result.query).toContain(offsetLimit);
        expect(result.query).not.toContain("TOP @limit");
      });

      test("should handle pagination with large offset", () => {
        const embeddings = [0.1, 0.2, 0.3];
        const offsetLimit = "OFFSET 1000 LIMIT 50";

        const result = (vectorStore as any).constructQuery(
          50,
          AzureCosmosDBNoSQLSearchType.Vector,
          { embeddings, offsetLimit }
        );
        console.log(result);
        expect(result.query).toContain(offsetLimit);
      });

      test("should use TOP when offsetLimit is not provided", () => {
        const embeddings = [0.1, 0.2, 0.3];

        const result = (vectorStore as any).constructQuery(
          25,
          AzureCosmosDBNoSQLSearchType.Vector,
          { embeddings }
        );
        console.log(result);
        expect(result.query).toContain("TOP @limit");
        expect(result.query).not.toContain("OFFSET");
      });
    });

    describe("Multiple Full-Text Fields Combinations", () => {
      test("should handle 5 full-text fields in ranking", () => {
        const fullTextRankFilter = [
          { searchField: "title", searchText: "azure" },
          { searchField: "description", searchText: "cosmos" },
          { searchField: "tags", searchText: "nosql" },
          { searchField: "category", searchText: "database" },
          { searchField: "content", searchText: "vector" },
        ];

        const result = (vectorStore as any).constructQuery(
          5,
          AzureCosmosDBNoSQLSearchType.FullTextRanking,
          { fullTextRankFilter }
        );
        console.log(result);
        expect(result.query).toContain("ORDER BY RANK RRF(");
        expect(result.query).toContain("FullTextScore(c[@title]");
        expect(result.query).toContain("FullTextScore(c[@description]");
        expect(result.query).toContain("FullTextScore(c[@tags]");
        expect(result.query).toContain("FullTextScore(c[@category]");
        expect(result.query).toContain("FullTextScore(c[@content]");
      });

      test("should handle full-text fields with varying term counts", () => {
        const fullTextRankFilter = [
          { searchField: "title", searchText: "one" },
          { searchField: "description", searchText: "one two three four five" },
          { searchField: "tags", searchText: "a b" },
        ];

        const result = (vectorStore as any).constructQuery(
          5,
          AzureCosmosDBNoSQLSearchType.FullTextRanking,
          { fullTextRankFilter }
        );
        console.log(result);
        expect(result.parameters).toContainEqual({
          name: "@title_term_0",
          value: "one",
        });
        expect(result.parameters).toContainEqual({
          name: "@description_term_4",
          value: "five",
        });
        expect(result.parameters).toContainEqual({
          name: "@tags_term_1",
          value: "b",
        });
      });
    });

    describe("Weight Distribution Scenarios", () => {
      test("should handle equal weights distribution", () => {
        const embeddings = [0.1, 0.2, 0.3];
        const fullTextRankFilter = [
          { searchField: "field1", searchText: "text1" },
          { searchField: "field2", searchText: "text2" },
        ];
        const weights = [0.333, 0.333, 0.334];

        const result = (vectorStore as any).constructQuery(
          5,
          AzureCosmosDBNoSQLSearchType.Hybrid,
          { embeddings, fullTextRankFilter, weights }
        );
        console.log(result);
        expect(result.parameters).toContainEqual({
          name: "@weights",
          value: weights,
        });
      });

      test("should handle skewed weights distribution", () => {
        const embeddings = [0.1, 0.2, 0.3];
        const fullTextRankFilter = [
          { searchField: "field1", searchText: "text1" },
        ];
        const weights = [0.9, 0.1];

        const result = (vectorStore as any).constructQuery(
          5,
          AzureCosmosDBNoSQLSearchType.Hybrid,
          { embeddings, fullTextRankFilter, weights }
        );
        console.log(result);
        expect(result.parameters).toContainEqual({
          name: "@weights",
          value: weights,
        });
      });
    });
  });
});
