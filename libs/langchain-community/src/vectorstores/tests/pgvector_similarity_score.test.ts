import { test, expect, describe, beforeAll, afterAll } from "@jest/globals";
import pg, { PoolConfig } from "pg";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { PGVectorStore } from "../pgvector";

describe("PGVectorStore Score Normalization", () => {
  const embeddings = new OpenAIEmbeddings({
    modelName: "text-embedding-3-small",
  });

  const postgresConnectionOptions = {
    type: "postgres",
    host: "127.0.0.1",
    port: 5432,
    user: "myuser",
    password: "ChangeMe",
    database: "api",
  } as PoolConfig;

  const tableName = "test_similarity_scores";
  let pool: pg.Pool;

  beforeAll(async () => {
    pool = new pg.Pool(postgresConnectionOptions);

    // Create the table with vector extension
    await pool.query("CREATE EXTENSION IF NOT EXISTS vector;");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        content text,
        metadata jsonb,
        embedding vector(1536)
      );
    `);
  });

  afterAll(async () => {
    // Clean up the test table
    await pool.query(`DROP TABLE IF EXISTS ${tableName};`);
    await pool.end();
  });

  test("Default behavior: scoreNormalization = 'distance' preserves original behavior", async () => {
    const vectorStore = new PGVectorStore(embeddings, {
      tableName,
      pool,
    });

    // Add test documents
    const docs = [
      new Document({
        pageContent: "prime annual ttc 65000",
        metadata: { id: 1 },
      }),
      new Document({
        pageContent: "annual prime ttc 65000",
        metadata: { id: 2 },
      }),
      new Document({ pageContent: "different content", metadata: { id: 3 } }),
    ];

    await vectorStore.addDocuments(docs);

    // Perform similarity search
    const results = await vectorStore.similaritySearchVectorWithScore(
      await embeddings.embedQuery("prime annual ttc 65000.93"),
      3
    );

    // With default 'distance' mode, lower scores should indicate more similarity
    expect(results).toHaveLength(3);

    // The first result should have the lowest distance score (most similar)
    const [firstDoc, firstScore] = results[0];
    const [secondDoc, secondScore] = results[1];
    const [thirdDoc, thirdScore] = results[2];

    // Verify that scores are distances (typically small values for similarities)
    expect(typeof firstScore).toBe("number");
    expect(typeof secondScore).toBe("number");
    expect(typeof thirdScore).toBe("number");

    // In distance mode, closer documents have lower scores
    expect(firstScore).toBeLessThanOrEqual(secondScore);
    expect(secondScore).toBeLessThanOrEqual(thirdScore);
  });

  test("scoreNormalization = 'distance' explicitly preserves original behavior", async () => {
    const vectorStore = new PGVectorStore(embeddings, {
      tableName,
      pool,
      scoreNormalization: "distance",
    });

    const docs = [
      new Document({ pageContent: "similar content one", metadata: { id: 1 } }),
      new Document({ pageContent: "similar content two", metadata: { id: 2 } }),
      new Document({
        pageContent: "completely different",
        metadata: { id: 3 },
      }),
    ];

    await vectorStore.addDocuments(docs);

    const results = await vectorStore.similaritySearchVectorWithScore(
      await embeddings.embedQuery("similar content"),
      3
    );

    expect(results).toHaveLength(3);

    // Verify distances are returned (lower = more similar)
    const [firstDoc, firstScore] = results[0];
    const [secondDoc, secondScore] = results[1];
    const [thirdDoc, thirdScore] = results[2];

    expect(firstScore).toBeLessThanOrEqual(secondScore);
    expect(secondScore).toBeLessThanOrEqual(thirdScore);
  });

  test("scoreNormalization = 'similarity' returns normalized similarity scores", async () => {
    const vectorStore = new PGVectorStore(embeddings, {
      tableName,
      pool,
      scoreNormalization: "similarity",
    });

    const docs = [
      new Document({
        pageContent: "high similarity content",
        metadata: { id: 1 },
      }),
      new Document({
        pageContent: "medium similarity content",
        metadata: { id: 2 },
      }),
      new Document({
        pageContent: "low similarity content",
        metadata: { id: 3 },
      }),
    ];

    await vectorStore.addDocuments(docs);

    const results = await vectorStore.similaritySearchVectorWithScore(
      await embeddings.embedQuery("high similarity content"),
      3
    );

    expect(results).toHaveLength(3);

    // With 'similarity' mode, higher scores should indicate more similarity
    const [firstDoc, firstScore] = results[0];
    const [secondDoc, secondScore] = results[1];
    const [thirdDoc, thirdScore] = results[2];

    // Verify that scores are similarity values (higher = more similar)
    expect(typeof firstScore).toBe("number");
    expect(typeof secondScore).toBe("number");
    expect(typeof thirdScore).toBe("number");

    // In similarity mode, closer documents have higher scores
    expect(firstScore).toBeGreaterThanOrEqual(secondScore);
    expect(secondScore).toBeGreaterThanOrEqual(thirdScore);

    // Verify scores are in reasonable similarity ranges
    expect(firstScore).toBeGreaterThanOrEqual(0);
    expect(secondScore).toBeGreaterThanOrEqual(0);
    expect(thirdScore).toBeGreaterThanOrEqual(0);
  });

  test("Different distance strategies work with score normalization", async () => {
    // Test cosine distance strategy
    const cosineVectorStore = new PGVectorStore(embeddings, {
      tableName,
      pool,
      distanceStrategy: "cosine",
      scoreNormalization: "similarity",
    });

    const docs = [
      new Document({ pageContent: "cosine test content", metadata: { id: 1 } }),
      new Document({
        pageContent: "different cosine content",
        metadata: { id: 2 },
      }),
    ];

    await cosineVectorStore.addDocuments(docs);

    const cosineResults =
      await cosineVectorStore.similaritySearchVectorWithScore(
        await embeddings.embedQuery("cosine test"),
        2
      );

    expect(cosineResults).toHaveLength(2);
    const [firstDoc, firstScore] = cosineResults[0];
    const [secondDoc, secondScore] = cosineResults[1];

    // Higher score should indicate more similarity in cosine strategy
    expect(firstScore).toBeGreaterThanOrEqual(secondScore);

    // Test euclidean distance strategy
    const euclideanVectorStore = new PGVectorStore(embeddings, {
      tableName,
      pool,
      distanceStrategy: "euclidean",
      scoreNormalization: "similarity",
    });

    const euclideanResults =
      await euclideanVectorStore.similaritySearchVectorWithScore(
        await embeddings.embedQuery("cosine test"),
        2
      );

    expect(euclideanResults).toHaveLength(2);
    const [euclideanFirst, euclideanFirstScore] = euclideanResults[0];
    const [euclideanSecond, euclideanSecondScore] = euclideanResults[1];

    // Higher score should indicate more similarity in euclidean strategy too
    expect(euclideanFirstScore).toBeGreaterThanOrEqual(euclideanSecondScore);
  });

  test("Score normalization preserves document ranking", async () => {
    const vectorStore = new PGVectorStore(embeddings, {
      tableName,
      pool,
      scoreNormalization: "similarity",
    });

    // Add documents with varying similarity to the query
    const docs = [
      new Document({
        pageContent: "very similar content for testing purposes",
        metadata: { id: 1 },
      }),
      new Document({
        pageContent: "moderately similar content for testing",
        metadata: { id: 2 },
      }),
      new Document({
        pageContent: "slightly similar content",
        metadata: { id: 3 },
      }),
      new Document({
        pageContent: "completely different unrelated content",
        metadata: { id: 4 },
      }),
    ];

    await vectorStore.addDocuments(docs);

    // Get results with similarity scoring
    const similarityResults = await vectorStore.similaritySearchVectorWithScore(
      await embeddings.embedQuery("similar content for testing"),
      4
    );

    // Reset table for distance comparison test
    await pool.query(`DELETE FROM ${tableName};`);
    await vectorStore.addDocuments(docs);

    // Get results with distance scoring (default)
    const distanceVectorStore = new PGVectorStore(embeddings, {
      tableName,
      pool,
      scoreNormalization: "distance",
    });

    const distanceResults =
      await distanceVectorStore.similaritySearchVectorWithScore(
        await embeddings.embedQuery("similar content for testing"),
        4
      );

    // The ranking should be the same (same documents in same order),
    // but the scores should be different (one uses distance, one uses similarity)
    expect(similarityResults.length).toBe(distanceResults.length);

    for (let i = 0; i < similarityResults.length; i++) {
      // The document content should be the same at each position
      expect(similarityResults[i][0].pageContent).toBe(
        distanceResults[i][0].pageContent
      );

      // But the scores should be different (converted using appropriate formula)
      expect(similarityResults[i][1]).not.toBe(distanceResults[i][1]);
    }

    // In similarity mode, scores should be higher
    // In distance mode, scores should be lower (raw distances)
    const similarityTopScore = similarityResults[0][1];
    const distanceTopScore = distanceResults[0][1];

    // The exact relationship depends on the conversion formula used
    // but generally similarity scores should be in [0,1] range while distances can vary
  });

  test("Edge cases with score normalization", async () => {
    const vectorStore = new PGVectorStore(embeddings, {
      tableName,
      pool,
      scoreNormalization: "similarity",
    });

    // Add identical documents to test near-zero distances
    const docs = [
      new Document({ pageContent: "identical content", metadata: { id: 1 } }),
      new Document({ pageContent: "identical content", metadata: { id: 2 } }), // Same content
    ];

    await vectorStore.addDocuments(docs);

    const results = await vectorStore.similaritySearchVectorWithScore(
      await embeddings.embedQuery("identical content"),
      2
    );

    expect(results).toHaveLength(2);

    // The first result should have the highest similarity score
    const [firstDoc, firstScore] = results[0];
    const [secondDoc, secondScore] = results[1];

    // With identical content, we expect very high similarity scores
    expect(firstScore).toBeGreaterThanOrEqual(secondScore);
    expect(firstScore).toBeGreaterThan(0.5); // Should be quite similar

    // Test with completely different content
    const differentVectorStore = new PGVectorStore(embeddings, {
      tableName,
      pool,
      scoreNormalization: "similarity",
    });

    await differentVectorStore.addDocuments([
      new Document({
        pageContent: "completely different content",
        metadata: { id: 1 },
      }),
    ]);

    const differentResults =
      await differentVectorStore.similaritySearchVectorWithScore(
        await embeddings.embedQuery("totally unrelated query"),
        1
      );

    // Even with very different content, we should get a valid similarity score
    expect(differentResults).toHaveLength(1);
    const [differentDoc, differentScore] = differentResults[0];
    expect(typeof differentScore).toBe("number");
    expect(differentScore).toBeGreaterThanOrEqual(0); // Should be non-negative
  });
});
