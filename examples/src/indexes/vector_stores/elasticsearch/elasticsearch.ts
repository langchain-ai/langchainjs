import { Client, ClientOptions } from "@elastic/elasticsearch";
import { Document } from "langchain/document";
import { OpenAI } from "langchain/llms/openai";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { VectorDBQAChain } from "langchain/chains";

import {
  ElasticClientArgs,
  ElasticVectorSearch,
} from "@langchain/community/vectorstores/elasticsearch";

// to run this first run Elastic's docker-container with `docker-compose up -d --build`
export async function run() {
  const config: ClientOptions = {
    node: process.env.ELASTIC_URL ?? "http://127.0.0.1:9200",
  };
  if (process.env.ELASTIC_API_KEY) {
    config.auth = {
      apiKey: process.env.ELASTIC_API_KEY,
    };
  } else if (process.env.ELASTIC_USERNAME && process.env.ELASTIC_PASSWORD) {
    config.auth = {
      username: process.env.ELASTIC_USERNAME,
      password: process.env.ELASTIC_PASSWORD,
    };
  }
  const clientArgs: ElasticClientArgs = {
    client: new Client(config),
    indexName: process.env.ELASTIC_INDEX ?? "test_vectorstore",
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

  const embeddings = new OpenAIEmbeddings();

  // await ElasticVectorSearch.fromDocuments(docs, embeddings, clientArgs);
  const vectorStore = new ElasticVectorSearch(embeddings, clientArgs);

  // Also supports an additional {ids: []} parameter for upsertion
  const ids = await vectorStore.addDocuments(docs);

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

  await vectorStore.delete({ ids });

  const response2 = await chain.call({ query: "What is Elasticsearch?" });

  console.log(JSON.stringify(response2, null, 2));

  /*
    []
  */
}
