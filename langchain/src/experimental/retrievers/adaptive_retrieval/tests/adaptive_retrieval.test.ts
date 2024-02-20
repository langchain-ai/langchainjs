import { test, expect } from "@jest/globals";
import { faker } from "@faker-js/faker";
import { Document } from "@langchain/core/documents";
import { v4 as uuidV4 } from "uuid";
import { SyntheticEmbeddings } from "@langchain/core/utils/testing";
import { MemoryVectorStore } from "../../../../vectorstores/memory.js";
import { AdaptiveRetrieval } from "../adaptive_retrieval.js";

test("Throws if a document is passed without an ID field", async () => {
  const smallEmbeddings = new SyntheticEmbeddings({
    vectorSize: 512,
  });
  const largeEmbeddings = new SyntheticEmbeddings({
    vectorSize: 3072,
  });

  const smallStore = new MemoryVectorStore(smallEmbeddings);
  const largeStore = new MemoryVectorStore(largeEmbeddings);

  const docsWithId = Array.from({ length: 10 }).map(
    () =>
      new Document({
        pageContent: faker.lorem.paragraph(5),
        metadata: { id: uuidV4() },
      })
  );
  const docWithoutId = new Document({
    pageContent: faker.lorem.paragraph(5),
    metadata: {
      noId: "noId",
    },
  });
  const allDocs = [...docsWithId, docWithoutId];

  const retriever = new AdaptiveRetrieval({
    smallStore,
    largeStore,
  });

  await expect(retriever.addDocuments(allDocs)).rejects.toThrow();
});

test("Can pass a custom ID field", async () => {
  const smallEmbeddings = new SyntheticEmbeddings({
    vectorSize: 512,
  });
  const largeEmbeddings = new SyntheticEmbeddings({
    vectorSize: 3072,
  });

  const smallStore = new MemoryVectorStore(smallEmbeddings);
  const largeStore = new MemoryVectorStore(largeEmbeddings);

  const docsWithId = Array.from({ length: 10 }).map(
    () =>
      new Document({
        pageContent: faker.lorem.paragraph(5),
        metadata: { customId: uuidV4() },
      })
  );
  const retriever = new AdaptiveRetrieval({
    smallStore,
    largeStore,
    idKey: "customId",
  });

  await expect(retriever.addDocuments(docsWithId)).resolves.not.toThrow();
});

test("Can change number of docs returned (largeK)", async () => {
  const smallEmbeddings = new SyntheticEmbeddings({
    vectorSize: 512,
  });
  const largeEmbeddings = new SyntheticEmbeddings({
    vectorSize: 3072,
  });

  const smallStore = new MemoryVectorStore(smallEmbeddings);
  const largeStore = new MemoryVectorStore(largeEmbeddings);

  const docsWithId = Array.from({ length: 10 }).map(
    () =>
      new Document({
        pageContent: "hello world",
        metadata: { id: uuidV4() },
      })
  );
  const retriever = new AdaptiveRetrieval({
    smallStore,
    largeStore,
    largeK: 10,
  });

  await retriever.addDocuments(docsWithId);

  const query = "hello world";
  const results = await retriever.getRelevantDocuments(query);
  expect(results.length).toBe(10);
});
