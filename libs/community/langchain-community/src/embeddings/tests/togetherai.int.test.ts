import { test, expect } from "@jest/globals";
import { TogetherAIEmbeddings } from "../togetherai.js";

test.skip("Test TogetherAIEmbeddings.embedQuery", async () => {
  const embeddings = new TogetherAIEmbeddings();
  const res = await embeddings.embedQuery("Hello world");
  expect(typeof res[0]).toBe("number");
  expect(res.length).toBe(768);
});

test.skip("Test TogetherAIEmbeddings.embedDocuments", async () => {
  const embeddings = new TogetherAIEmbeddings();
  const res = await embeddings.embedDocuments(["Hello world", "Bye bye"]);
  expect(res).toHaveLength(2);
  expect(typeof res[0][0]).toBe("number");
  expect(typeof res[1][0]).toBe("number");
  expect(res[0].length).toBe(768);
  expect(res[1].length).toBe(768);
});
