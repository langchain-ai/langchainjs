import { test, expect } from "@jest/globals";

import { OpenAIEmbeddings } from "../../embeddings/openai.js";
import { Document } from "../../document.js";
import { MemoryVectorStore } from "../memory.js";

test("MemoryVectorStore with external ids", async () => {
  const embeddings = new OpenAIEmbeddings();

  const store = new MemoryVectorStore(embeddings);

  expect(store).toBeDefined();

  await store.addDocuments([
    { pageContent: "hello", metadata: { a: 1 } },
    { pageContent: "hi", metadata: { a: 1 } },
    { pageContent: "bye", metadata: { a: 1 } },
    { pageContent: "what's this", metadata: { a: 1 } },
  ]);

  const results = await store.similaritySearch("hello", 1);

  expect(results).toHaveLength(1);

  expect(results).toEqual([
    new Document({ metadata: { a: 1 }, pageContent: "hello" }),
  ]);
});
