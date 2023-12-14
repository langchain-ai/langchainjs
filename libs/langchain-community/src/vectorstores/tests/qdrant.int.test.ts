/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect, test } from "@jest/globals";
import { QdrantClient } from "@qdrant/js-client-rest";
import { faker } from "@faker-js/faker";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { QdrantVectorStore } from "../qdrant.js";
import { OllamaEmbeddings } from "../../embeddings/ollama.js";

describe.skip("QdrantVectorStore testcase", () => {
  test("base usage", async () => {
    const embeddings = new OpenAIEmbeddings({});

    const qdrantVectorStore = new QdrantVectorStore(embeddings, {
      url: process.env.QDRANT_URL || "http://localhost:6333",
      collectionName: process.env.QDRANT_COLLECTION || "documents",
    });

    const pageContent = faker.lorem.sentence(5);

    await qdrantVectorStore.addDocuments([{ pageContent, metadata: {} }]);

    const results = await qdrantVectorStore.similaritySearch(pageContent, 1);

    expect(results[0]).toEqual(new Document({ metadata: {}, pageContent }));
  });

  test("passing client directly with a local model that creates embeddings with a different number of dimensions", async () => {
    const embeddings = new OllamaEmbeddings({});

    const pageContent = faker.lorem.sentence(5);

    const qdrantVectorStore = await QdrantVectorStore.fromDocuments(
      [{ pageContent, metadata: {} }],
      embeddings,
      {
        collectionName: "different_dimensions",
        client: new QdrantClient({
          url: process.env.QDRANT_URL,
          apiKey: process.env.QDRANT_API_KEY,
        }),
      }
    );

    const results = await qdrantVectorStore.similaritySearch(pageContent, 1);

    expect(results[0]).toEqual(new Document({ metadata: {}, pageContent }));
  });
});
