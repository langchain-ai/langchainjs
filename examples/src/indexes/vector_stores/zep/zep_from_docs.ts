import { ZepVectorStore } from "langchain/vectorstores/zep";
import { FakeEmbeddings } from "langchain/embeddings/fake";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { randomUUID } from "crypto";

const loader = new TextLoader("src/document_loaders/example_data/example.txt");
const docs = await loader.load();
export const run = async () => {
  const collectionName = `collection${randomUUID().split("-")[0]}`;

  const zepConfig = {
    apiUrl: "http://localhost:8000", // this should be the URL of your Zep implementation
    collectionName,
    embeddingDimensions: 1536, // this much match the width of the embeddings you're using
    isAutoEmbedded: true, // If true, the vector store will automatically embed documents when they are added
  };

  const embeddings = new FakeEmbeddings();

  const vectorStore = await ZepVectorStore.fromDocuments(
    docs,
    embeddings,
    zepConfig
  );

  // Wait for the documents to be embedded
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const c = await vectorStore.client.document.getCollection(collectionName);
    console.log(
      `Embedding status: ${c.document_embedded_count}/${c.document_count} documents embedded`
    );
    // eslint-disable-next-line no-promise-executor-return
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (c.status === "ready") {
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
};
