import { MyscaleStore } from "langchain/vectorstores/myscale";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";

export async function run() {
  // Create a store and fill it with some texts + metadata
  const vectorStore = await MyscaleStore.fromTexts(
    ["Hello world", "Bye bye", "hello nice world"],
    [
      { id: 2, name: "2" },
      { id: 1, name: "1" },
      { id: 3, name: "3" },
    ],
    new OpenAIEmbeddings(),
    {
      host: process.env.MYSCALE_HOST || "http://localhost:8443",
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
}
