import { expect, test } from "@jest/globals";
import { DataSourceOptions } from "typeorm";
import { OpenAIEmbeddings } from "../../embeddings/openai.js";
import { TypeORMVectorStore } from "../typeorm.js";

test.skip("Test embeddings creation", async () => {
  const args = {
    postgresConnectionOptions: {
      type: "postgres",
      host: "localhost",
      port: 5432,
      username: "myuser",
      password: "!ChangeMe!",
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
    sourceName: "hello.txt",
  };
  const docHi = { pageContent: "hi", metadata: { a: 1 }, sourceName: "hi.txt" };
  const docCat = {
    pageContent: "Cat drinks milk",
    metadata: { a: 2, sourceName: "cat.txt" },
  };

  await typeormVectorStore.addDocuments([
    docHello,
    docHi,
    docCat,
    { pageContent: "what's this", metadata: { a: 3, sourceName: "what.txt" } },
  ]);

  const results = await typeormVectorStore.similaritySearch("hello", 2, {
    a: 1,
  });

  expect(results).toHaveLength(1);

  expect(results[0].pageContent).toEqual(docHello.pageContent);

  // We now test the update of a document
  await typeormVectorStore.addDocuments([
    { ...docCat, pageContent: "Cat is drinking milk" },
  ]);

  const results2 = await typeormVectorStore.similaritySearch(
    "Cat drinks milk",
    1
  );

  expect(results2).toHaveLength(1);

  expect(results2[0].pageContent).toEqual("Cat is drinking milk");

  await typeormVectorStore.appDataSource.query(
      'TRUNCATE TABLE "testlangchain"'
  );
  await typeormVectorStore.appDataSource.destroy();
});
