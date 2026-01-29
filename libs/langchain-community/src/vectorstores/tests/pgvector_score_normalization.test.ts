import { expect, test } from "@jest/globals";
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
    host: process.env.TEST_PG_HOST || "127.0.0.1",
    port: parseInt(process.env.TEST_PG_PORT || "5432"),
    user: process.env.TEST_PG_USER || "myuser",
    password: process.env.TEST_PG_PASSWORD || "ChangeMe",
    database: process.env.TEST_PG_DATABASE || "api",
  } as PoolConfig;

  const tableName = "test_score_norm";
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
        embedding vector(3)  -- Using small dimension for test simplicity
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

    // Add test documents with known differences
    const docs = [
      new Document({ pageContent: "apple fruit red", metadata: { id: 1 } }),
      new Document({ pageContent: "banana fruit yellow", metadata: { id: 2 } }),
      new Document({
        pageContent: "car vehicle transportation",
        metadata: { id: 3 },
      }),
    ];

    await vectorStore.addDocuments(docs);

    // Perform similarity search
    const results = await vectorStore.similaritySearchVectorWithScore(
      await embeddings.embedQuery("red apple fruit"),
      3
    );

    expect(results).toHaveLength(3);

    // With default 'distance' mode, lower scores should indicate more similarity
    const [firstDoc, firstScore] = results[0];
    const [secondDoc, secondScore] = results[1];
    const [thirdDoc, thirdScore] = results[2];

    // Verify that scores are numbers (distances in this case)
    expect(typeof firstScore).toBe("number");
    expect(typeof secondScore).toBe("number");
    expect(typeof thirdScore).toBe("number");

    // In distance mode, closer documents have lower scores (more similar)
    expect(firstScore).toBeLessThanOrEqual(secondScore);
    expect(secondScore).toBeLessThanOrEqual(thirdScore);
  });

  test("scoreNormalization = 'distance' explicitly preserves original behavior", async () => {
    const vectorStore = new PGVectorStore(embeddings, {
      tableName,
      pool,
      scoreNormalization: "distance",
    });

    // Clear and add test documents
    await pool.query(`DELETE FROM ${tableName};`);

    const docs = [
      new Document({ pageContent: "cat animal pet", metadata: { id: 1 } }),
      new Document({ pageContent: "dog animal pet", metadata: { id: 2 } }),
      new Document({
        pageContent: "car vehicle transportation",
        metadata: { id: 3 },
      }),
    ];

    await vectorStore.addDocuments(docs);

    const results = await vectorStore.similaritySearchVectorWithScore(
      await embeddings.embedQuery("pet animal cat"),
      3
    );

    expect(results).toHaveLength(3);

    // Verify distances are returned (lower = more similar)
    const [firstDoc, firstScore] = results[0];
    const [secondDoc, secondScore] = results[1];
    const [thirdDoc, thirdScore] = results[2];

    // In distance mode, closer documents have lower scores
    expect(firstScore).toBeLessThanOrEqual(secondScore);
    expect(secondScore).toBeLessThanOrEqual(thirdScore);
  });

  test("scoreNormalization = 'similarity' returns normalized similarity scores", async () => {
    const vectorStore = new PGVectorStore(embeddings, {
      tableName,
      pool,
      scoreNormalization: "similarity",
    });

    // Clear and add test documents
    await pool.query(`DELETE FROM ${tableName};`);

    const docs = [
      new Document({ pageContent: "summer season warm", metadata: { id: 1 } }),
      new Document({ pageContent: "winter season cold", metadata: { id: 2 } }),
      new Document({
        pageContent: "programming code computer",
        metadata: { id: 3 },
      }),
    ];

    await vectorStore.addDocuments(docs);

    const results = await vectorStore.similaritySearchVectorWithScore(
      await embeddings.embedQuery("warm summer season"),
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

    // Similarity scores should be positive and in reasonable ranges
    expect(firstScore).toBeGreaterThan(0);
    expect(secondScore).toBeGreaterThan(0);
    expect(thirdScore).toBeGreaterThan(0);
  });

  test("Different distance strategies work with score normalization", async () => {
    // Test cosine distance strategy
    const cosineVectorStore = new PGVectorStore(embeddings, {
      tableName,
      pool,
      distanceStrategy: "cosine",
      scoreNormalization: "similarity",
    });

    // Clear and add test documents
    await pool.query(`DELETE FROM ${tableName};`);

    const docs = [
      new Document({
        pageContent: "technology computer science",
        metadata: { id: 1 },
      }),
      new Document({
        pageContent: "science technology research",
        metadata: { id: 2 },
      }),
      new Document({
        pageContent: "sports football game",
        metadata: { id: 3 },
      }),
    ];

    await cosineVectorStore.addDocuments(docs);

    const cosineResults =
      await cosineVectorStore.similaritySearchVectorWithScore(
        await embeddings.embedQuery("computer science technology"),
        2
      );

    expect(cosineResults).toHaveLength(2);
    const [firstDoc, firstScore] = cosineResults[0];
    const [secondDoc, secondScore] = cosineResults[1];

    // Higher score should indicate more similarity in cosine strategy
    expect(firstScore).toBeGreaterThanOrEqual(secondScore);
    // Cosine similarity scores should be in reasonable range
    expect(firstScore).toBeGreaterThan(0);

    // Test euclidean distance strategy
    const euclideanVectorStore = new PGVectorStore(embeddings, {
      tableName,
      pool,
      distanceStrategy: "euclidean",
      scoreNormalization: "similarity",
    });

    const euclideanResults =
      await euclideanVectorStore.similaritySearchVectorWithScore(
        await embeddings.embedQuery("computer science technology"),
        2
      );

    expect(euclideanResults).toHaveLength(2);
    const [euclideanFirst, euclideanFirstScore] = euclideanResults[0];
    const [euclideanSecond, euclideanSecondScore] = euclideanResults[1];

    // Higher score should indicate more similarity in euclidean strategy too
    expect(euclideanFirstScore).toBeGreaterThanOrEqual(euclideanSecondScore);
    // Euclidean similarity scores should be positive
    expect(euclideanFirstScore).toBeGreaterThan(0);
  });

  test("Score normalization preserves document ranking", async () => {
    const similarityVectorStore = new PGVectorStore(embeddings, {
      tableName,
      pool,
      scoreNormalization: "similarity",
    });

    // Clear and add test documents
    await pool.query(`DELETE FROM ${tableName};`);

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

    await similarityVectorStore.addDocuments(docs);

    // Get results with similarity scoring
    const similarityResults =
      await similarityVectorStore.similaritySearchVectorWithScore(
        await embeddings.embedQuery("similar content for testing"),
        4
      );

    // Reset table and test with distance scoring
    await pool.query(`DELETE FROM ${tableName};`);
    await similarityVectorStore.addDocuments(docs);

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

    // In similarity mode, scores should be higher values
    // In distance mode, scores should be lower (raw distances)
    const similarityTopScore = similarityResults[0][1];
    const distanceTopScore = distanceResults[0][1];
    expect(typeof similarityTopScore).toBe("number");
    expect(typeof distanceTopScore).toBe("number");
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
