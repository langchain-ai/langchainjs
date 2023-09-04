/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { beforeEach, describe, expect, test } from "@jest/globals";
import { faker } from "@faker-js/faker";
import { Document } from "../../document.js";
import { OpenAIEmbeddings } from "../../embeddings/openai.js";
import { QdrantVectorStore } from "../qdrant.js";

describe("QdrantVectorStore testcase", () => {
  let qdrantVectorStore: QdrantVectorStore;

  beforeEach(async () => {
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    qdrantVectorStore = new QdrantVectorStore(embeddings, {
      url: process.env.QDRANT_URL || "http://localhost:6333",
      collectionName: process.env.QDRANT_COLLECTION || "documents",
    });
  });

  test.skip("base usage", async () => {
    const pageContent = faker.lorem.sentence(5);

    await qdrantVectorStore.addDocuments([{ pageContent, metadata: {} }]);

    const results = await qdrantVectorStore.similaritySearch(pageContent, 1);

    expect(results[0]).toEqual(new Document({ metadata: {}, pageContent }));
  });
});
