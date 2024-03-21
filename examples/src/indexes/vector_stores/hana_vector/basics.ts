import { OpenAIEmbeddings } from "@langchain/openai";
import hanaClient from "@sap/hana-client";
import { Document } from "@langchain/core/documents";
import {
  HanaDB,
  HanaDBArgs,
} from "@langchain/community/vectorstores/hanavector";

const connectionParams = {
  host: process.env.HANA_HOST,
  port: process.env.HANA_PORT,
  uid: process.env.HANA_UID,
  pwd: process.env.HANA_PWD,
};
const embeddings = new OpenAIEmbeddings();
// connet to hanaDB
const client = hanaClient.createConnection();
client.connect(connectionParams);
// define instance args
const args: HanaDBArgs = {
  connection: client,
  tableName: "testBasics",
};

// Add documents with metadata.
const docs: Document[] = [
  {
    pageContent: "foo",
    metadata: { start: 100, end: 150, docName: "foo.txt", quality: "bad" },
  },
  {
    pageContent: "bar",
    metadata: { start: 200, end: 250, docName: "bar.txt", quality: "good" },
  },
];

// Create a LangChain VectorStore interface for the HANA database and specify the table (collection) to use in args.
const vectorStore = new HanaDB(embeddings, args);
// Delete already existing documents from the table
await vectorStore.delete({ filter: {} });
await vectorStore.addDocuments(docs);
// Query documents with specific metadata.
const filterMeta = { quality: "bad" };
const query = "foobar";
// With filtering on {"quality": "bad"}, only one document should be returned
const results = await vectorStore.similaritySearch(query, 1, filterMeta);
console.log(results);
/*
    [  {
        pageContent: "foo",
        metadata: { start: 100, end: 150, docName: "foo.txt", quality: "bad" }
      }
    ]
*/
// Delete documents with specific metadata.
await vectorStore.delete({ filter: filterMeta });
// Now the similarity search with the same filter will return no results
const resultsAfterFilter = await vectorStore.similaritySearch(
  query,
  1,
  filterMeta
);
console.log(resultsAfterFilter);
/*
    []
*/
