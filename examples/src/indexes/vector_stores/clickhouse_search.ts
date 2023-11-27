import { ClickHouseStore } from "langchain/vectorstores/clickhouse";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";

// Initialize ClickHouse store
const vectorStore = await ClickHouseStore.fromExistingIndex(
  new OpenAIEmbeddings(),
  {
    host: process.env.CLICKHOUSE_HOST || "localhost",
    port: process.env.CLICKHOUSE_PORT || 8443,
    username: process.env.CLICKHOUSE_USER || "username",
    password: process.env.CLICKHOUSE_PASSWORD || "password",
    database: process.env.CLICKHOUSE_DATABASE || "default",
    table: process.env.CLICKHOUSE_TABLE || "vector_table",
  }
);

// Sleep 1 second to ensure that the search occurs after the successful insertion of data.
// eslint-disable-next-line no-promise-executor-return
await new Promise((resolve) => setTimeout(resolve, 1000));

// Perform similarity search without filtering
const results = await vectorStore.similaritySearch("hello world", 1);
console.log(results);

// Perform similarity search with filtering
const filteredResults = await vectorStore.similaritySearch("hello world", 1, {
  whereStr: "metadata.name = '1'",
});
console.log(filteredResults);
