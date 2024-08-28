import { test } from "@jest/globals";
import { MistralAIEmbeddings } from "../embeddings.js";

test("Test MistralAIEmbeddings can embed query", async () => {
  const model = new MistralAIEmbeddings();
  // "Hello world" in French 🤓
  const text = "Bonjour le monde";
  const embeddings = await model.embedQuery(text);
  // console.log("embeddings", embeddings);
  expect(embeddings.length).toBe(1024);
});

test("Test MistralAIEmbeddings can embed documents", async () => {
  const model = new MistralAIEmbeddings();
  // "Hello world" in French 🤓
  const text = "Bonjour le monde";
  const documents = [text, text];
  const embeddings = await model.embedDocuments(documents);
  // console.log("embeddings", embeddings);
  expect(embeddings.length).toBe(2);
  expect(embeddings[0].length).toBe(1024);
  expect(embeddings[1].length).toBe(1024);
});
