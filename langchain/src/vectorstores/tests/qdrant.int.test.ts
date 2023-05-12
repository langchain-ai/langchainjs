/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { beforeEach, describe, expect, test } from "@jest/globals";
import { faker } from "@faker-js/faker";
import { QdrantClient } from "@qdrant/js-client-rest";
import { Document } from "../../document.js";
import { OpenAIEmbeddings } from "../../embeddings/openai.js";
import { QdrantVectorStore } from "../qdrant.js";

describe("QdrantVectorStore testcase", () => {
  let qdrantVectorStore: QdrantVectorStore;

  beforeEach(async () => {
    const client = new QdrantClient({
      url: process.env.QDRANT_URL,
      port: Number(process.env.QDRANT_PORT),
    });

    await client.createCollection(
      process.env.QDRANT_COLLECTION || "documents",
      {
        vectors: {
          size: 1536,
          distance: "Cosine",
        },
      }
    );

    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    qdrantVectorStore = new QdrantVectorStore(embeddings, {
      client,
      collectionName: process.env.QDRANT_COLLECTION || "documents",
    });
  });

  test("base usage", async () => {
    const pageContent = faker.lorem.sentence(5);

    await qdrantVectorStore.addDocuments([{ pageContent, metadata: {} }]);

    const results = await qdrantVectorStore.similaritySearch(pageContent, 1);

    expect(results[0]).toEqual([new Document({ metadata: {}, pageContent })]);
  });
});
