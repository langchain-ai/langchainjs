import { MyScaleStore } from "langchain/vectorstores/myscale";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";

const vectorStore = await MyScaleStore.fromExistingIndex(
  new OpenAIEmbeddings(),
  {
    host: process.env.MYSCALE_HOST || "localhost",
    port: process.env.MYSCALE_PORT || "8443",
    username: process.env.MYSCALE_USERNAME || "username",
    password: process.env.MYSCALE_PASSWORD || "password",
    database: "your_database", // defaults to "default"
    table: "your_table", // defaults to "vector_table"
  }
);

const results = await vectorStore.similaritySearch("hello world", 1);
console.log(results);

const filteredResults = await vectorStore.similaritySearch("hello world", 1, {
  whereStr: "metadata.name = '1'",
});
console.log(filteredResults);
