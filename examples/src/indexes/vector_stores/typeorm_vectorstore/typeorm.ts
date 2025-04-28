import { DataSourceOptions } from "typeorm";
import { OpenAIEmbeddings } from "@langchain/openai";
import { TypeORMVectorStore } from "@langchain/community/vectorstores/typeorm";

// First, follow set-up instructions at
// https://js.langchain.com/docs/modules/indexes/vector_stores/integrations/typeorm

export const run = async () => {
  const args = {
    postgresConnectionOptions: {
      type: "postgres",
      host: "localhost",
      port: 5432,
      username: "myuser",
      password: "ChangeMe",
      database: "api",
    } as DataSourceOptions,
  };

  const typeormVectorStore = await TypeORMVectorStore.fromDataSource(
    new OpenAIEmbeddings(),
    args
  );

  await typeormVectorStore.ensureTableInDatabase();

  await typeormVectorStore.addDocuments([
    { pageContent: "what's this", metadata: { a: 2 } },
    { pageContent: "Cat drinks milk", metadata: { a: 1 } },
  ]);

  const results = await typeormVectorStore.similaritySearch("hello", 2);

  console.log(results);
};
