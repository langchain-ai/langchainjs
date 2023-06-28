import { Client } from "@elastic/elasticsearch";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { ElasticsearchVectorStore } from "langchain/vectorstores/elasticsearch";

// to run this first run chroma's docker-container with `docker-compose up -d --build`
export async function run() {
  const client = new Client({
    nodes: [process.env.ELASTICSEARCH_URL ?? "http://127.0.0.1:9200"],
    auth: {
      username: process.env.ELASTIC_USERNAME ?? 'elastic',
      password: process.env.ELASTIC_PASSWORD,
    }
  });

  const vectorStore = await ElasticsearchVectorStore.fromTexts(
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
  // [ Document { pageContent: 'Hello world', metadata: { id: 2 } } ]
}
