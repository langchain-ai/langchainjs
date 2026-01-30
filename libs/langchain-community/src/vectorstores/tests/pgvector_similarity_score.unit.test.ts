import { describe, expect, test } from "@jest/globals";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { PGVectorStore } from "../pgvector.js";

// Mock the dependencies to avoid requiring a database connection
class MockEmbeddings implements EmbeddingsInterface {
  embedQuery(text: string): Promise<number[]> {
    // Return a deterministic embedding for testing
    return Promise.resolve(Array(10).fill(parseFloat(text.length.toString())));
  }

  embedDocuments(texts: string[]): Promise<number[][]> {
    return Promise.resolve(
      texts.map((text) => Array(10).fill(parseFloat(text.length.toString())))
    );
  }
}

// Create a simplified test to validate the score normalization functionality
describe("PGVectorStore Score Normalization - Unit Tests", () => {
  test("convertDistanceToScore method works correctly for different strategies", () => {
    // Create a mock instance to access the private method
    const embeddings = new MockEmbeddings();
    const config = {
      tableName: "test_table",
      postgresConnectionOptions: {
        host: "test",
        port: 5432,
        user: "test",
        password: "test",
        database: "test",
      },
    };

    // Create an instance without calling initialization methods that require DB
    const vectorStore = new PGVectorStore(embeddings, config);

    // Test cosine distance conversion: similarity = 1 - distance
    const cosineDistance = 0.2;
    // @ts-expect-error - convertDistanceToScore is private
    const cosineSimilarity = vectorStore.convertDistanceToScore(cosineDistance);
    expect(cosineSimilarity).toBe(1 - cosineDistance);

    // Test euclidean distance conversion: similarity = 1 / (1 + distance)
    vectorStore.distanceStrategy = "euclidean";
    const euclideanDistance = 0.5;
    // @ts-expect-error - convertDistanceToScore is private
    const euclideanSimilarity = vectorStore.convertDistanceToScore(euclideanDistance);
    expect(euclideanSimilarity).toBe(1 / (1 + euclideanDistance));

    // Test inner product conversion: similarity = -distance
    vectorStore.distanceStrategy = "innerProduct";
    const innerProductDistance = -0.8; // This would be a negative value from pgvector
    // @ts-expect-error - convertDistanceToScore is private
    const innerProductSimilarity = vectorStore.convertDistanceToScore(innerProductDistance);
    expect(innerProductSimilarity).toBe(-innerProductDistance);
  });

  test("scoreNormalization property is properly initialized", () => {
    const embeddings = new MockEmbeddings();

    // Test default initialization (should be "distance")
    const config1 = {
      tableName: "test_table",
      postgresConnectionOptions: {
        host: "test",
        port: 5432,
        user: "test",
        password: "test",
        database: "test",
      },
    };

    const vectorStore1 = new PGVectorStore(embeddings, config1);
    expect(vectorStore1.scoreNormalization).toBe("distance");

    // Test explicit "distance" initialization
    const config2 = {
      ...config1,
      scoreNormalization: "distance" as const,
    };

    const vectorStore2 = new PGVectorStore(embeddings, config2);
    expect(vectorStore2.scoreNormalization).toBe("distance");

    // Test "similarity" initialization
    const config3 = {
      ...config1,
      scoreNormalization: "similarity" as const,
    };

    const vectorStore3 = new PGVectorStore(embeddings, config3);
    expect(vectorStore3.scoreNormalization).toBe("similarity");
  });

  test("distance to similarity conversion formulas work correctly", () => {
    const embeddings = new MockEmbeddings();
    const config = {
      tableName: "test_table",
      postgresConnectionOptions: {
        host: "test",
        port: 5432,
        user: "test",
        password: "test",
        database: "test",
      },
    };

    const vectorStore = new PGVectorStore(embeddings, config);

    // Test cosine conversion: similarity = 1 - distance
    vectorStore.distanceStrategy = "cosine";
    // @ts-expect-error - convertDistanceToScore is private
    expect(vectorStore.convertDistanceToScore(0)).toBe(1); // Identical vectors
    // @ts-expect-error - convertDistanceToScore is private
    expect(vectorStore.convertDistanceToScore(1)).toBe(0); // Orthogonal
    // @ts-expect-error - convertDistanceToScore is private
    expect(vectorStore.convertDistanceToScore(2)).toBe(-1); // Opposite vectors

    // Test euclidean conversion: similarity = 1 / (1 + distance)
    vectorStore.distanceStrategy = "euclidean";
    // @ts-expect-error - convertDistanceToScore is private
    expect(vectorStore.convertDistanceToScore(0)).toBe(1); // Identical points
    // @ts-expect-error - convertDistanceToScore is private
    expect(vectorStore.convertDistanceToScore(1)).toBe(0.5); // Distance of 1
    // @ts-expect-error - convertDistanceToScore is private
    expect(vectorStore.convertDistanceToScore(9)).toBe(0.1); // Distance of 9

    // Test inner product conversion: similarity = -distance
    vectorStore.distanceStrategy = "innerProduct";
    // @ts-expect-error - convertDistanceToScore is private
    expect(vectorStore.convertDistanceToScore(0)).toBe(0); // Orthogonal
    // @ts-expect-error - convertDistanceToScore is private
    expect(vectorStore.convertDistanceToScore(-1)).toBe(1); // Aligned
    // @ts-expect-error - convertDistanceToScore is private
    expect(vectorStore.convertDistanceToScore(-5)).toBe(5); // More aligned
  });

  test("score normalization respects configuration", () => {
    const embeddings = new MockEmbeddings();

    // With distance mode (default), should return raw distance
    const configDistance = {
      tableName: "test_table",
      postgresConnectionOptions: {
        host: "test",
        port: 5432,
        user: "test",
        password: "test",
        database: "test",
      },
      scoreNormalization: "distance" as const,
    };

    const vectorStoreDistance = new PGVectorStore(embeddings, configDistance);
    vectorStoreDistance.distanceStrategy = "cosine";
    const rawDistance = 0.3;
    // @ts-expect-error - convertDistanceToScore is private
    const distanceResult = vectorStoreDistance.convertDistanceToScore(rawDistance);
    expect(distanceResult).toBe(rawDistance); // Should return raw distance

    // With similarity mode, should convert distance to similarity
    const configSimilarity = {
      ...configDistance,
      scoreNormalization: "similarity" as const,
    };

    const vectorStoreSimilarity = new PGVectorStore(embeddings, configSimilarity);
    vectorStoreSimilarity.distanceStrategy = "cosine";
    // @ts-expect-error - convertDistanceToScore is private
    const similarityResult = vectorStoreSimilarity.convertDistanceToScore(rawDistance);
    expect(similarityResult).toBe(1 - rawDistance); // Should convert to similarity
    expect(similarityResult).not.toBe(rawDistance); // Should not be the same as raw distance
  });
});
