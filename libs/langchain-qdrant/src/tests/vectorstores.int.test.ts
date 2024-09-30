/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect, test } from "@jest/globals";
import { QdrantClient } from "@qdrant/js-client-rest";
import { faker } from "@faker-js/faker";
import { Document } from "@langchain/core/documents";
import { SyntheticEmbeddings } from "@langchain/core/utils/testing";
import { v4 } from "uuid";
import { QdrantVectorStore } from "../vectorstores.js";

describe("QdrantVectorStore testcase", () => {
  test("base usage", async () => {
    const embeddings = new SyntheticEmbeddings({
      vectorSize: 1536,
    });

    const qdrantVectorStore = new QdrantVectorStore(embeddings, {
      url: process.env.QDRANT_URL || "http://localhost:6333",
      collectionName: process.env.QDRANT_COLLECTION || "documents",
    });

    const pageContent = faker.lorem.sentence(5);
    const id = v4();

    await qdrantVectorStore.addDocuments([{ pageContent, metadata: {}, id }]);

    const results = await qdrantVectorStore.similaritySearch(pageContent, 1);

    expect(results[0]).toEqual(new Document({ metadata: {}, pageContent, id }));

    expect(qdrantVectorStore.maxMarginalRelevanceSearch).toBeDefined();

    const mmrResults = await qdrantVectorStore.maxMarginalRelevanceSearch(
      pageContent,
      {
        k: 1,
      }
    );
    expect(mmrResults.length).toBe(1);
    expect(mmrResults[0]).toEqual(
      new Document({ metadata: {}, pageContent, id })
    );
  });

  test("passing client directly with a model that creates embeddings with a different number of dimensions", async () => {
    const embeddings = new SyntheticEmbeddings({
      vectorSize: 384,
    });

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

    expect(results[0].metadata).toEqual({});
    expect(results[0].pageContent).toEqual(pageContent);
  });
});
