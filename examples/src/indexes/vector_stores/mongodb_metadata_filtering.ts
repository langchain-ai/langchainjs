import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { CohereEmbeddings } from "@langchain/cohere";
import { MongoClient } from "mongodb";

import { sleep } from "langchain/util/time";

const client = new MongoClient(process.env.MONGODB_ATLAS_URI || "");
const namespace = "langchain.test";
const [dbName, collectionName] = namespace.split(".");
const collection = client.db(dbName).collection(collectionName);

const vectorStore = new MongoDBAtlasVectorSearch(new CohereEmbeddings(), {
  collection,
  indexName: "default", // The name of the Atlas search index. Defaults to "default"
  textKey: "text", // The name of the collection field containing the raw content. Defaults to "text"
  embeddingKey: "embedding", // The name of the collection field containing the embedded text. Defaults to "embedding"
});

await vectorStore.addDocuments([
  {
    pageContent: "Hey hey hey",
    metadata: { docstore_document_id: "somevalue" },
  },
]);

const retriever = vectorStore.asRetriever({
  filter: {
    preFilter: {
      docstore_document_id: {
        $eq: "somevalue",
      },
    },
  },
});

// Mongo has a slight processing delay between ingest and availability
await sleep(2000);

const results = await retriever.invoke("goodbye");

console.log(results);

await client.close();
