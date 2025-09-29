import hanaClient from "hdb";
import {
  HanaDB,
  HanaDBArgs,
} from "@langchain/community/vectorstores/hanavector";
import { OpenAIEmbeddings } from "@langchain/openai";

// table "test_fromDocs" is already created with the previous example.
// Now, we will use this existing table to create indexes and perform similarity search.

const connectionParams = {
  host: process.env.HANA_HOST,
  port: process.env.HANA_PORT,
  user: process.env.HANA_UID,
  password: process.env.HANA_PWD,
};
const client = hanaClient.createClient(connectionParams);

// Connect to SAP HANA
await new Promise<void>((resolve, reject) => {
  client.connect((err: Error) => {
    if (err) {
      reject(err);
    } else {
      console.log("Connected to SAP HANA successfully.");
      resolve();
    }
  });
});

// Initialize embeddings
const embeddings = new OpenAIEmbeddings();

// First instance using the existing table "test_fromDocs" (default: Cosine similarity)
const argsCosine: HanaDBArgs = {
  connection: client,
  tableName: "test_fromDocs",
};

// Second instance using the existing table "test_fromDocs" but with L2 Euclidean distance
const argsL2: HanaDBArgs = {
  connection: client,
  tableName: "test_fromDocs",
  distanceStrategy: "euclidean", // Use Euclidean distance for this instance
};

// Initialize both HanaDB instances
const vectorStoreCosine = new HanaDB(embeddings, argsCosine);
const vectorStoreL2 = new HanaDB(embeddings, argsL2);

// Create HNSW index with Cosine similarity (default)
await vectorStoreCosine.createHnswIndex({
  indexName: "hnsw_cosine_index",
  efSearch: 400,
  m: 50,
  efConstruction: 150,
});

// Create HNSW index with Euclidean (L2) distance
await vectorStoreL2.createHnswIndex({
  indexName: "hnsw_l2_index",
  efSearch: 400,
  m: 50,
  efConstruction: 150,
});

// Query text for similarity search
const query = "What did the president say about Ketanji Brown Jackson";

// Perform similarity search using the default Cosine index
const docsCosine = await vectorStoreCosine.similaritySearch(query, 2);
console.log("Cosine Similarity Results:");
docsCosine.forEach((doc) => {
  console.log("-".repeat(80));
  console.log(doc.pageContent);
});
/*
Cosine Similarity Results:
----------------------------------------------------------------------
One of the most serious constitutional ... 

And I did that 4 days ago, when I ...
----------------------------------------------------------------------
As I said last year, especially ... 

While it often appears that we never agree, that isn’t true...
*/
// Perform similarity search using Euclidean distance (L2 index)
const docsL2 = await vectorStoreL2.similaritySearch(query, 2);
console.log("Euclidean (L2) Distance Results:");
docsL2.forEach((doc) => {
  console.log("-".repeat(80));
  console.log(doc.pageContent);
});
// The L2 distance results should be the same as cosine search results.

// Disconnect from SAP HANA after the operations
client.disconnect();
