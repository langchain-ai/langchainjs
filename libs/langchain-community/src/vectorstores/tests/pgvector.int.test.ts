import { expect, test } from "@jest/globals";
import type { PoolConfig } from "pg";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PGVectorStore } from "../pgvector.js";

describe("PGVectorStore", () => {
  let pgvectorVectorStore: PGVectorStore;
  const tableName = "testlangchain";

  beforeAll(async () => {
    const config = {
      postgresConnectionOptions: {
        type: "postgres",
        host: "127.0.0.1",
        port: 5433,
        user: "myuser",
        password: "ChangeMe",
        database: "api",
      } as PoolConfig,
      tableName: "testlangchain",
      // collectionTableName: "langchain_pg_collection",
      // collectionName: "langchain",
      columns: {
        idColumnName: "id",
        vectorColumnName: "vector",
        contentColumnName: "content",
        metadataColumnName: "metadata",
      },
    };

    pgvectorVectorStore = await PGVectorStore.initialize(
      new OpenAIEmbeddings(),
      config
    );
  });

  afterEach(async () => {
    // Drop table, then recreate it for the next test.
    await pgvectorVectorStore.pool.query(`DROP TABLE "${tableName}"`);
    await pgvectorVectorStore.ensureTableInDatabase();
  });

  afterAll(async () => {
    await pgvectorVectorStore.end();
  });

  test("Test embeddings creation", async () => {
    const documents = [
      {
        pageContent: "hello",
        metadata: { a: 1 },
      },
      {
        pageContent: "Cat drinks milk",
        metadata: { a: 2 },
      },
      { pageContent: "hi", metadata: { a: 1 } },
    ];
    await pgvectorVectorStore.addDocuments(documents);
    const results = await pgvectorVectorStore.similaritySearch("hello", 2, {
      a: 2,
    });

    expect(results).toHaveLength(1);
    expect(results[0].pageContent).toEqual("Cat drinks milk");
  });

  test("PGvector can save documents with a list greater than default chunk size", async () => {
    try {
      // Extract the default chunk size and add one.
      const docsToGenerate = pgvectorVectorStore.chunkSize + 1;
      const documents = [];
      for (let i = 1; i <= docsToGenerate; i += 1) {
        documents.push({ pageContent: "Lorem Ipsum", metadata: { a: i } });
      }
      await pgvectorVectorStore.addDocuments(documents);

      // Query the table to check the number of rows
      const result = await pgvectorVectorStore.pool.query(
        `SELECT COUNT(*) FROM "${tableName}"`
      );
      const rowCount = parseInt(result.rows[0].count, 10);
      // Check if the number of rows is equal to the number of documents added
      expect(rowCount).toEqual(docsToGenerate);
    } catch (e) {
      console.error("Error: ", e);
      throw e;
    }
  });

  test("PGvector can delete document by id", async () => {
    try {
      const documents = [
        { pageContent: "Lorem Ipsum", metadata: { a: 1 } },
        { pageContent: "Lorem Ipsum", metadata: { a: 2 } },
        { pageContent: "Lorem Ipsum", metadata: { a: 3 } },
      ];
      await pgvectorVectorStore.addDocuments(documents);

      const result = await pgvectorVectorStore.pool.query(
        `SELECT id FROM "${tableName}"`
      );

      const initialIds = result.rows.map((row) => row.id);
      const firstIdToDelete = initialIds[0];
      const secondIdToDelete = initialIds[1];
      const idToKeep = initialIds[2];

      await pgvectorVectorStore.delete({
        ids: [firstIdToDelete, secondIdToDelete],
      });

      const result2 = await pgvectorVectorStore.pool.query(
        `SELECT id FROM "${tableName}"`
      );

      // Only one row should be left
      expect(result2.rowCount).toEqual(1);

      // The deleted ids should not be in the result
      const idsAfterDelete = result2.rows.map((row) => row.id);
      expect(idsAfterDelete).not.toContain(firstIdToDelete);
      expect(idsAfterDelete).not.toContain(secondIdToDelete);

      expect(idsAfterDelete).toContain(idToKeep);
    } catch (e) {
      console.error("Error: ", e);
      throw e;
    }
  });

  test("PGvector can delete document by metadata", async () => {
    try {
      const documents = [
        { pageContent: "Lorem Ipsum", metadata: { a: 1, b: 1 } },
        { pageContent: "Lorem Ipsum", metadata: { a: 2, b: 1 } },
        { pageContent: "Lorem Ipsum", metadata: { a: 1, c: 1 } },
      ];
      await pgvectorVectorStore.addDocuments(documents);
      const result = await pgvectorVectorStore.pool.query(
        `SELECT id FROM "${tableName}"`
      );

      const initialIds = result.rows.map((row) => row.id);

      // Filter Matches 1st document
      await pgvectorVectorStore.delete({ filter: { a: 1, b: 1 } });

      const result2 = await pgvectorVectorStore.pool.query(
        `SELECT id FROM "${tableName}"`
      );

      // Two rows should be left
      expect(result2.rowCount).toEqual(2);

      const idsAfterDelete = result2.rows.map((row) => row.id);

      // The document with matching metadata should not be in the database
      expect(idsAfterDelete).not.toContainEqual(initialIds[0]);

      // All other documents should still be in database
      expect(idsAfterDelete).toContainEqual(initialIds[1]);
      expect(idsAfterDelete).toContainEqual(initialIds[2]);
    } catch (e) {
      console.error("Error: ", e);
      throw e;
    }
  });
});
