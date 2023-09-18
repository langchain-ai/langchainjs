import { expect, test } from "@jest/globals";
import { PoolConfig } from "pg";
import { OpenAIEmbeddings } from "../../embeddings/openai.js";
import { PGVectorStore } from "../pgvector.js";

test("Test embeddings creation", async () => {
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
    columns: {
      idColumnName: "id",
      vectorColumnName: "vector",
      contentColumnName: "content",
      metadataColumnName: "metadata",
    },
  };

  const pgvectorVectorStore = await PGVectorStore.initialize(
    new OpenAIEmbeddings(),
    config
  );

  expect(pgvectorVectorStore).toBeDefined();

  const docHello = {
    pageContent: "hello",
    metadata: { a: 1 },
  };
  const docCat = {
    pageContent: "Cat drinks milk",
    metadata: { a: 2 },
  };
  const docHi = { pageContent: "hi", metadata: { a: 1 } };

  await pgvectorVectorStore.addDocuments([docHello, docHi, docCat]);

  const results = await pgvectorVectorStore.similaritySearch("hello", 2, {
    a: 2,
  });

  expect(results).toHaveLength(1);

  expect(results[0].pageContent).toEqual(docCat.pageContent);

  await pgvectorVectorStore.pool.query('TRUNCATE TABLE "testlangchain"');

  await pgvectorVectorStore.end();
});
