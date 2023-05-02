import { MyScaleStore } from "langchain/vectorstores/myscale";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";

const vectorStore = await MyScaleStore.fromTexts(
  ["Hello world", "Bye bye", "hello nice world"],
  [
    { id: 2, name: "2" },
    { id: 1, name: "1" },
    { id: 3, name: "3" },
  ],
  new OpenAIEmbeddings(),
  {
    host: process.env.MYSCALE_HOST || "localhost",
    port: process.env.MYSCALE_PORT || "8443",
    username: process.env.MYSCALE_USERNAME || "username",
    password: process.env.MYSCALE_PASSWORD || "password",
  }
);

const results = await vectorStore.similaritySearch("hello world", 1);
console.log(results);

const filteredResults = await vectorStore.similaritySearch("hello world", 1, {
  whereStr: "metadata.name = '1'",
});
console.log(filteredResults);
