import { SingleStoreVectorStore } from "langchain/vectorstores/singlestore";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { createPool } from "mysql2/promise";

export const run = async () => {
  const pool = createPool({
    host: process.env.SINGLESTORE_HOST,
    port: Number(process.env.SINGLESTORE_PORT),
    user: process.env.SINGLESTORE_USERNAME,
    password: process.env.SINGLESTORE_PASSWORD,
    database: process.env.SINGLESTORE_DATABASE,
  });

  const vectorStore = await SingleStoreVectorStore.fromTexts(
    ["Hello world", "Bye bye", "hello nice world"],
    [{ id: 2 }, { id: 1 }, { id: 3 }],
    new OpenAIEmbeddings(),
    {
      connectionPool: pool,
    }
  );

  const resultOne = await vectorStore.similaritySearch("hello world", 1);
  console.log(resultOne);
  await pool.end();
};
