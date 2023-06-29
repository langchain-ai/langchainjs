import { Client } from "@elastic/elasticsearch";
import { Document } from "langchain/document";
import { OpenAI } from "langchain/llms/openai";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import {
  ElasticsearchClientArgs,
  ElasticsearchVectorStore,
} from "langchain/vectorstores/elasticsearch";
import { VectorDBQAChain } from "langchain/chains";

// to run this first run chroma's docker-container with `docker-compose up -d --build`
export async function run() {
  const config: ElasticsearchClientArgs = {
    client: new Client({
      nodes: [process.env.ELASTICSEARCH_URL ?? "http://127.0.0.1:9200"],
      auth: {
        username: process.env.ELASTIC_USERNAME ?? "elastic",
        password: process.env.ELASTIC_PASSWORD ?? "changeme",
      },
      /*
      // Using API key instead of username and password
      auth: {
        apiKey: process.env.ELASTIC_API_KEY
      }
      */
    }),
    indexName: process.env.ELASTICSEARCH_INDEX ?? "test_vectorstore",
  };

  // Index documents

  const docs = [
    new Document({
      metadata: { foo: "bar" },
      pageContent: "Elasticsearch is a powerful vector db",
    }),
    new Document({
      metadata: { foo: "bar" },
      pageContent: "the quick brown fox jumped over the lazy dog",
    }),
    new Document({
      metadata: { baz: "qux" },
      pageContent: "lorem ipsum dolor sit amet",
    }),
    new Document({
      metadata: { baz: "qux" },
      pageContent:
        "Elasticsearch a distributed, RESTful search engine optimized for speed and relevance on production-scale workloads.",
    }),
  ];

  const embeddings = new OpenAIEmbeddings(undefined, {
    baseOptions: { temperature: 0 },
  });

  await ElasticsearchVectorStore.fromDocuments(docs, embeddings, config);

  const vectorStore = new ElasticsearchVectorStore(embeddings, config);

  /* Search the vector DB independently with meta filters */
  const results = await vectorStore.similaritySearch("fox jump", 1);
  console.log(JSON.stringify(results, null, 2));
  /* [
        {
          "pageContent": "the quick brown fox jumped over the lazy dog",
          "metadata": {
            "foo": "bar"
          }
        }
    ]
  */

  /* Use as part of a chain (currently no metadata filters) for LLM query */
  const model = new OpenAI();
  const chain = VectorDBQAChain.fromLLM(model, vectorStore, {
    k: 1,
    returnSourceDocuments: true,
  });
  const response = await chain.call({ query: "What is Elasticsearch?" });

  console.log(JSON.stringify(response, null, 2));
  /* 
    {
      "text": " Elasticsearch is a distributed, RESTful search engine optimized for speed and relevance on production-scale workloads.",
      "sourceDocuments": [
        {
          "pageContent": "Elasticsearch a distributed, RESTful search engine optimized for speed and relevance on production-scale workloads.",
          "metadata": {
            "baz": "qux"
          }
        }
      ]
    }
    */
}
