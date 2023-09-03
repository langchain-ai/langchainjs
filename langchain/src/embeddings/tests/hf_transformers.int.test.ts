import { test, expect } from "@jest/globals";
import { HuggingFaceTransformersEmbeddings } from "../hf_transformers.js";
import { MemoryVectorStore } from "../../vectorstores/memory.js";
import { Document } from "../../document.js";

test("HuggingFaceTransformersEmbeddings", async () => {
  const embeddings = new HuggingFaceTransformersEmbeddings();

  const documents = [
    "Hello world!",
    "Hello bad world!",
    "Hello nice world!",
    "Hello good world!",
    "1 + 1 = 2",
    "1 + 1 = 3",
  ];

  const queryEmbedding = await embeddings.embedQuery(documents[0]);
  expect(queryEmbedding).toHaveLength(384);
  expect(typeof queryEmbedding[0]).toBe("number");

  const store = new MemoryVectorStore(embeddings);

  await store.addDocuments(
    documents.map((pageContent) => new Document({ pageContent }))
  );

  expect(await store.similaritySearch(documents[4], 2)).toMatchInlineSnapshot(`
    [
      Document {
        "metadata": {},
        "pageContent": "1 + 1 = 2",
      },
      Document {
        "metadata": {},
        "pageContent": "1 + 1 = 3",
      },
    ]
  `);
});
