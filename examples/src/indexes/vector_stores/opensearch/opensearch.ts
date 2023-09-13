import { Client } from "@opensearch-project/opensearch";
import { Document } from "langchain/document";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { OpenSearchVectorStore } from "langchain/vectorstores/opensearch";
import * as uuid from "uuid";

export async function run() {
  const client = new Client({
    nodes: [process.env.OPENSEARCH_URL ?? "http://127.0.0.1:9200"],
  });

  const embeddings = new OpenAIEmbeddings();

  const vectorStore = await OpenSearchVectorStore.fromTexts(
    ["Hello world", "Bye bye", "What's this?"],
    [{ id: 2 }, { id: 1 }, { id: 3 }],
    embeddings,
    {
      client,
      indexName: "documents",
    }
  );

  const resultOne = await vectorStore.similaritySearch("Hello world", 1);
  console.log(resultOne);

  const vectorStore2 = new OpenSearchVectorStore(embeddings, {
    client,
    indexName: "custom",
  });

  const documents = [
    new Document({
      pageContent: "Do I dare to eat an apple?",
      metadata: {
        foo: "baz",
      },
    }),
    new Document({
      pageContent: "There is no better place than the hotel lobby",
      metadata: {
        foo: "bar",
      },
    }),
    new Document({
      pageContent: "OpenSearch is a powerful vector db",
      metadata: {
        foo: "bat",
      },
    }),
  ];
  const vectors = Array.from({ length: documents.length }, (_, i) => [
    i,
    i + 1,
    i + 2,
  ]);
  const ids = Array.from({ length: documents.length }, () => uuid.v4());
  await vectorStore2.addVectors(vectors, documents, { ids });

  const resultTwo = await vectorStore2.similaritySearchVectorWithScore(
    vectors[0],
    3
  );
  console.log(resultTwo);
}
