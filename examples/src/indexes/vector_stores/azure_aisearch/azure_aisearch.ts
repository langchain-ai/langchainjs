import { Document } from "langchain/document";
import { OpenAI } from "langchain/llms/openai";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import {
  AzureSearchStore,
} from "langchain/vectorstores/azuresearch";
import { VectorDBQAChain } from "langchain/chains";

// to run this first run Elastic's docker-container with `docker-compose up -d --build`
export async function run() {
  const docs = [
    new Document({
      metadata: { source: "bar" },
      pageContent: "AzureSearch is a powerful search engine that supports vector db",
    }),
    new Document({
      metadata: { source: "bar" },
      pageContent: "nodejs is a powerful platform to build IA apps",
    }),
    new Document({
      metadata: { source: "qux" },
      pageContent: "lorem ipsum dolor sit amet",
    }),
    new Document({
      metadata: { source: "qux" },
      pageContent:
        "AzureSearch can be used to keyword based search, semantic search and similarity search. You can also combine that with LLMs to create a QA system",
    }),
  ];

  const embeddings = new OpenAIEmbeddings(undefined, {
    baseOptions: { temperature: 0 },
  });

  // will create an instance of vector store and create the index if not exists
  const vectorStore = AzureSearchStore.create({
    client: {
      indexName: '<YOUR_INDEX_NAME>',
      endpoint: '<YOUR_ENDPOINT>', // ex: https://<YOUR_SERVICE_NAME>.search.windows.net
      credential: '<YOUR_ADMIN_API_KEY>'
    },
    search: {
      type: 'similarity', // also supports 'semantic_hybrid' and 'similarity_hybrid'
    }
  }, embeddings);

  // Also supports an additional {keys: []} parameter for upsertion
  const keys = await vectorStore.addDocuments(docs);

  /* Search the vector DB */
  const results = await vectorStore.similaritySearch("fox jump", 1);
  console.log(JSON.stringify(results, null, 2));
  /* [
        {
          "pageContent": "the quick brown fox jumped over the lazy dog",
          "metadata": {
            "source": "bar"
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
  const response = await chain.call({ query: "What is AzureSearch?" });

  console.log(JSON.stringify(response, null, 2));
  /*
    {
      "text": "AzureSearch is a powerful search engine that supports vector db",
      "sourceDocuments": [
        {
          "pageContent": "AzureSearch is a powerful search engine that supports vector db",
          "metadata": {
            "source": "bar"
          }
        }
      ]
    }
    */

  await vectorStore.deleteByKey(keys);

  const response2 = await chain.call({ query: "What is Azure Search?" });
  console.log(JSON.stringify(response2, null, 2));

  /*
    []
  */
}
