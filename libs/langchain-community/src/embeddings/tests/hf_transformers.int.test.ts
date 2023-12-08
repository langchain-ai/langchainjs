import { test, expect } from "@jest/globals";
import { HuggingFaceTransformersEmbeddings } from "../hf_transformers.js";
import { HNSWLib } from "../../vectorstores/hnswlib.js";

test("HuggingFaceTransformersEmbeddings", async () => {
  const embeddings = new HuggingFaceTransformersEmbeddings();

  const texts = [
    "Hello world!",
    "Hello bad world!",
    "Hello nice world!",
    "Hello good world!",
    "1 + 1 = 2",
    "1 + 1 = 3",
  ];

  const queryEmbedding = await embeddings.embedQuery(texts[0]);
  expect(queryEmbedding).toHaveLength(384);
  expect(typeof queryEmbedding[0]).toBe("number");

  const store = await HNSWLib.fromTexts(texts, {}, embeddings);

  expect(await store.similaritySearch(texts[4], 2)).toMatchInlineSnapshot(`
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
