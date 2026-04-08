import {
  MongoDBAtlasVectorSearch,
  type MongoDBAtlasVectorSearchLibArgs,
} from "@langchain/mongodb";
import { OpenAIEmbeddings } from "@langchain/openai";
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_ATLAS_URI || "");
const namespace = "langchain.test";
const [dbName, collectionName] = namespace.split(".");
const collection = client.db(dbName).collection(collectionName);

const vectorstore = await MongoDBAtlasVectorSearch.fromTexts(
  ["Hello world", "Bye bye", "What's this?"],
  [{ id: 2 }, { id: 1 }, { id: 3 }],
  // Use OpenAI embeddings here because the Cohere integration is no longer
  // managed in this repository.
  new OpenAIEmbeddings(),
  {
    collection,
    indexName: "default", // The name of the Atlas search index. Defaults to "default"
    textKey: "text", // The name of the collection field containing the raw content. Defaults to "text"
    embeddingKey: "embedding", // The name of the collection field containing the embedded text. Defaults to "embedding"
  } as unknown as MongoDBAtlasVectorSearchLibArgs
);

const assignedIds = await vectorstore.addDocuments([
  { pageContent: "upsertable", metadata: {} },
]);

const upsertedDocs = [{ pageContent: "overwritten", metadata: {} }];

await vectorstore.addDocuments(upsertedDocs, { ids: assignedIds });

await client.close();
