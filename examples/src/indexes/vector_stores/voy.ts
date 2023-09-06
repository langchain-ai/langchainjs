import { Voy } from "langchain/vectorstores/voy";
import { Voy as VoiClient } from "voy-search";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { Document } from "langchain/document";

export async function run() {
  // Create Voy client using the library.
  const voyClient = new VoiClient();
  // Create embeddings
  const embeddings = new OpenAIEmbeddings();
  // Create the Voy store.
  const store = new Voy(voyClient, embeddings);

  // Add two documents with some metadata.
  await store.addDocuments([
    new Document({
      pageContent: "How has life been treating you?",
      metadata: {
        foo: "Mike",
      },
    }),
    new Document({
      pageContent: "And I took it personally...",
      metadata: {
        foo: "Mommy",
      },
    }),
  ]);

  const model = new OpenAIEmbeddings();
  const query = await model.embedQuery(
    "Winning has a price. Leadership has a price."
  );

  // Perform a similarity search.
  const resultsWithScore = await store.similaritySearchVectorWithScore(
    query,
    1
  );

  // Print the results.
  console.log(JSON.stringify(resultsWithScore, null, 2));
  // [
  //   [
  //     {
  //       "pageContent": "How has life been treating you?",
  //       "metadata": {
  //         "foo": "Mike"
  //       }
  //     },
  //     0
  //   ]
  // ]
}
