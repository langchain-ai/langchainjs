// Run with: yarn example src/indexes/vector_stores/opensearch/opensearch.ts

import { Client } from "@opensearch-project/opensearch";
import { OpenAIEmbeddings } from "langchain/embeddings";
import { OpenSearchVectorStore } from "langchain/vectorstores";

export async function run() {
  const client = new Client({
    nodes: [process.env.OPENSEARCH_URL ?? "http://127.0.0.1:9200"],
  });

  const vectorStore = await OpenSearchVectorStore.fromTexts(
    ["Hello world", "Bye bye", "What's this?"],
    [{ id: 2 }, { id: 1 }, { id: 3 }],
    new OpenAIEmbeddings(),
    {
      client,
      indexName: "documents",
    }
  );

  const resultOne = await vectorStore.similaritySearch("Hello world", 1);
  console.log(resultOne);
}
