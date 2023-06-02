import { test, expect } from "@jest/globals";
import { XenovaTransformersEmbeddings } from "../xenovatransformers.js";

test("Test XenovaTransformersEmbeddings.embedQuery", async () => {
  const embeddings = new XenovaTransformersEmbeddings();
  const res = await embeddings.embedQuery("Hello world");
  expect(typeof res[0]).toBe("number");
});

test("Test XenovaTransformersEmbeddings.embedDocuments", async () => {
  const embeddings = new XenovaTransformersEmbeddings();
  const res = await embeddings.embedDocuments(["Hello world", "Bye bye"]);
  expect(res).toHaveLength(2);
  expect(typeof res[0][0]).toBe("number");
  expect(typeof res[1][0]).toBe("number");
});
