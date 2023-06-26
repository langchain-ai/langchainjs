import { Client } from "@elastic/elasticsearch";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { ElasticsearchVectorStore } from "langchain/vectorstores/elasticsearch";
import * as fs from "fs";

export async function run() {
  const client = new Client({
    nodes: [process.env.ELASTICSEARCH_URL ?? "https://127.0.0.1:9200"],
    auth: {
      username: "elastic",
      password: process.env.ELASTIC_PASSWORD,
    },
    tls: {
      ca: fs.readFileSync("config/certs/ca/ca.crt"),
      rejectUnauthorized: false,
    },
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
}
