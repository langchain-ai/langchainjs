import { PineconeClient } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { PineconeStore } from "langchain/vectorstores/pinecone";

// To run this example, first [create a Pinecone index](https://app.pinecone.io/organizations)
// It must have 1536 dimensions, to match the OpenAI embedding size.
// It should use the metric "cosine" to get the results below.
// Point to this index from your .env.

export const run = async () => {
  if (
    !process.env.PINECONE_API_KEY ||
    !process.env.PINECONE_ENVIRONMENT ||
    !process.env.PINECONE_INDEX
  ) {
    throw new Error(
      "PINECONE_ENVIRONMENT and PINECONE_API_KEY and PINECONE_INDEX must be set"
    );
  }

  const client = new PineconeClient();
  await client.init({
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT,
  });
  const index = client.Index(process.env.PINECONE_INDEX);

  const vectorStore = await PineconeStore.fromTexts(
    ["Hello world", "Bye bye", "hello nice world"],
    [{ foo: "bar" }, { foo: "baz" }, { foo: "qux" }],
    new OpenAIEmbeddings(),
    { pineconeIndex: index }
  );

  /* Without metadata filtering */
  let result = await vectorStore.similaritySearchWithScore("Hello world", 3);
  console.dir(result, { depth: null });
  /*
  [
    [
      Document { pageContent: 'Hello world', metadata: { foo: 'bar' } },
      1
    ],
    [
      Document {
        pageContent: 'hello nice world',
        metadata: { foo: 'qux' }
      },
      0.939860761
    ],
    [
      Document { pageContent: 'Bye bye', metadata: { foo: 'baz' } },
      0.827194452
    ]
  ]
  */

  /* With metadata filtering */
  result = await vectorStore.similaritySearchWithScore("Hello world", 3, {
    foo: "bar",
  });
  console.dir(result, { depth: null });
  /*
  [
    [
      Document { pageContent: 'Hello world', metadata: { foo: 'bar' } },
      0.999995887
    ]
  ]
  */
};
