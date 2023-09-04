import { VectorDocumentStore } from "@tigrisdata/vector";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { TigrisVectorStore } from "langchain/vectorstores/tigris";

const index = new VectorDocumentStore({
  connection: {
    serverUrl: "api.preview.tigrisdata.cloud",
    projectName: process.env.TIGRIS_PROJECT,
    clientId: process.env.TIGRIS_CLIENT_ID,
    clientSecret: process.env.TIGRIS_CLIENT_SECRET,
  },
  indexName: "examples_index",
  numDimensions: 1536, // match the OpenAI embedding size
});

const vectorStore = await TigrisVectorStore.fromExistingIndex(
  new OpenAIEmbeddings(),
  { index }
);

/* Search the vector DB independently with metadata filters */
const results = await vectorStore.similaritySearch("tigris", 1, {
  "metadata.foo": "bar",
});
console.log(JSON.stringify(results, null, 2));
/*
[
  Document {
    pageContent: 'tigris is a cloud-native vector db',
    metadata: { foo: 'bar' }
  }
]
*/
