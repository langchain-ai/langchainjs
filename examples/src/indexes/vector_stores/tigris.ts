import { VectorDocumentStore } from "@tigrisdata/vector";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { TigrisVectorStore } from "langchain/vectorstores/tigris";

// To run this example, first
// [create a Tigris project and fetch the API credentials](https://www.tigrisdata.com/docs/concepts/vector-search/getting-started/#2-fetch-tigris-api-credentials).
// Point to your Tigris project from your .env.

export const run = async () => {
  if (
    !process.env.TIGRIS_URI ||
    !process.env.TIGRIS_PROJECT ||
    !process.env.TIGRIS_CLIENT_ID ||
    !process.env.TIGRIS_CLIENT_SECRET
  ) {
    throw new Error(
      "TIGRIS_URI, TIGRIS_PROJECT, TIGRIS_CLIENT_ID and TIGRIS_CLIENT_SECRET must be set"
    );
  }

  const index = new VectorDocumentStore({
    connection: {
      serverUrl: process.env.TIGRIS_URI,
      projectName: process.env.TIGRIS_PROJECT,
      clientId: process.env.TIGRIS_CLIENT_ID,
      clientSecret: process.env.TIGRIS_CLIENT_SECRET,
    },
    indexName: "examples_index",
    numDimensions: 1536, // match the OpenAI embedding size
  });

  const vectorStore = await TigrisVectorStore.fromTexts(
    ["Hello world", "Bye bye", "hello nice world"],
    [{ foo: "bar" }, { foo: "baz" }, { foo: "qux" }],
    new OpenAIEmbeddings(),
    { index }
  );

  /* Without metadata filtering */
  let result = await vectorStore.similaritySearchWithScore("Hello world", 1);
  console.log(JSON.stringify(result, null, 2));
  /*
    [
    [
        {
        "pageContent": "Hello world",
        "metadata": {
            "foo": "bar"
        }
        },
        4.76837158203125e-7
    ]
    ]
  */

  /* With metadata filtering */
  result = await vectorStore.similaritySearchWithScore("Hello world", 1, {
    "metadata.foo": "qux",
  });
  console.log(JSON.stringify(result, null, 2));
  /*
    [
    [
        {
        "pageContent": "hello nice world",
        "metadata": {
            "foo": "qux"
        }
        },
        0.06021904945373535
    ]
    ]
  */
};
