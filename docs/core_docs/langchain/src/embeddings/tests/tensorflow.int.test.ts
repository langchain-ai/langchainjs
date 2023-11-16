import { test, expect } from "@jest/globals";
import "@tensorflow/tfjs-backend-cpu";
import { TensorFlowEmbeddings } from "../tensorflow.js";
import { MemoryVectorStore } from "../../vectorstores/memory.js";
import { Document } from "../../document.js";

test("TensorflowEmbeddings", async () => {
  const embeddings = new TensorFlowEmbeddings();

  const documents = [
    "Hello world!",
    "Hello bad world!",
    "Hello nice world!",
    "Hello good world!",
    "1 + 1 = 2",
    "1 + 1 = 3",
  ];

  const queryEmbedding = await embeddings.embedQuery(documents[0]);
  expect(queryEmbedding).toHaveLength(512);
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
