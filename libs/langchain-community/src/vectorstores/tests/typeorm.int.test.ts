import { expect, test } from "@jest/globals";
import { DataSourceOptions } from "typeorm";
import { OpenAIEmbeddings } from "@langchain/openai";
import { TypeORMVectorStore } from "../typeorm.js";

test.skip("Test embeddings creation", async () => {
  const args = {
    postgresConnectionOptions: {
      type: "postgres",
      host: "localhost",
      port: 5432,
      username: "myuser",
      password: "ChangeMe",
      database: "api",
    } as DataSourceOptions,
    tableName: "testlangchain",
  };

  const typeormVectorStore = await TypeORMVectorStore.fromDataSource(
    new OpenAIEmbeddings(),
    args
  );

  expect(typeormVectorStore).toBeDefined();

  const docHello = {
    pageContent: "hello",
    metadata: { a: 1 },
  };
  const docCat = {
    pageContent: "Cat drinks milk",
    metadata: { a: 2 },
  };
  const docHi = { pageContent: "hi", metadata: { a: 1 } };

  await typeormVectorStore.addDocuments([docHello, docHi, docCat]);

  const results = await typeormVectorStore.similaritySearch("hello", 2, {
    a: 2,
  });

  expect(results).toHaveLength(1);

  expect(results[0].pageContent).toEqual(docCat.pageContent);

  await typeormVectorStore.appDataSource.query(
    'TRUNCATE TABLE "testlangchain"'
  );

  await typeormVectorStore.appDataSource.destroy();
});
