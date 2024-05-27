import { ZepCloudVectorStore } from "@langchain/community/vectorstores/zep_cloud";
import { FakeEmbeddings } from "@langchain/core/utils/testing";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { randomUUID } from "crypto";

const loader = new TextLoader("src/document_loaders/example_data/example.txt");
const docs = await loader.load();
const collectionName = `collection${randomUUID().split("-")[0]}`;

const zepConfig = {
  // Your Zep Cloud Project API key https://help.getzep.com/projects
  apiKey: "<Zep Api Key>",
  collectionName,
};

// We're using fake embeddings here, because Zep Cloud handles embedding for you
const embeddings = new FakeEmbeddings();

const vectorStore = await ZepCloudVectorStore.fromDocuments(
  docs,
  embeddings,
  zepConfig
);

// Wait for the documents to be embedded
// eslint-disable-next-line no-constant-condition
while (true) {
  const c = await vectorStore.client.document.getCollection(collectionName);
  console.log(
    `Embedding status: ${c.documentEmbeddedCount}/${c.documentCount} documents embedded`
  );
  // eslint-disable-next-line no-promise-executor-return
  await new Promise((resolve) => setTimeout(resolve, 1000));
  if (c.documentEmbeddedCount === c.documentCount) {
    break;
  }
}

const results = await vectorStore.similaritySearchWithScore("bar", 3);

console.log("Similarity Results:");
console.log(JSON.stringify(results));

const results2 = await vectorStore.maxMarginalRelevanceSearch("bar", {
  k: 3,
});

console.log("MMR Results:");
console.log(JSON.stringify(results2));
