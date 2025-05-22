import { test, expect } from "@jest/globals";
import { HuggingFaceInferenceEmbeddings } from "../hf.js";
import { HNSWLib } from "../../vectorstores/hnswlib.js";

test("HuggingFaceInferenceEmbeddings", async () => {
  const embeddings = new HuggingFaceInferenceEmbeddings();

  const texts = [
    "Hello world!",
    "Hello bad world!",
    "Hello nice world!",
    "Hello good world!",
    "1 + 1 = 2",
    "1 + 1 = 3",
  ];

  const queryEmbedding = await embeddings.embedQuery(texts[0]);
  expect(queryEmbedding).toHaveLength(768);
  expect(typeof queryEmbedding[0]).toBe("number");

  const store = await HNSWLib.fromTexts(texts, {}, embeddings);

  expect(await store.similaritySearch(texts[4], 2)).toMatchInlineSnapshot(`
    [
      Document {
        "id": undefined,
        "metadata": {},
        "pageContent": "1 + 1 = 2",
      },
      Document {
        "id": undefined,
        "metadata": {},
        "pageContent": "1 + 1 = 3",
      },
    ]
  `);
});

test("HuggingFaceInferenceEmbeddings with explicit model and provider", async () => {
  const model = "BAAI/bge-small-en-v1.5";
  const provider = "hf-inference";
  const embeddings = new HuggingFaceInferenceEmbeddings({
    model,
    provider,
  });

  const texts = ["Integration test input 1", "Integration test input 2"];

  const queryEmbedding = await embeddings.embedQuery(texts[0]);
  expect(Array.isArray(queryEmbedding)).toBe(true);
  expect(typeof queryEmbedding[0]).toBe("number");

  const store = await HNSWLib.fromTexts(texts, {}, embeddings);
  const results = await store.similaritySearch(texts[1], 1);

  expect(results.length).toBe(1);
  expect(results[0].pageContent).toBe("Integration test input 2");
});
