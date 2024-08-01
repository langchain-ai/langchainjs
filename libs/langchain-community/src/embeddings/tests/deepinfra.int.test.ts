import { test, expect } from "@jest/globals";
import { DeepInfraEmbeddings } from "../deepinfra.js";

test("Test DeepInfraEmbeddings.embedQuery", async () => {
  const embeddings = new DeepInfraEmbeddings();
  const res = await embeddings.embedQuery("Hello world");
  expect(typeof res[0]).toBe("number");
});

test("Test DeepInfraEmbeddings.embedDocuments", async () => {
  const embeddings = new DeepInfraEmbeddings();
  const res = await embeddings.embedDocuments(["Hello world", "Bye bye"]);
  expect(res).toHaveLength(2);
  expect(typeof res[0][0]).toBe("number");
  expect(typeof res[1][0]).toBe("number");
});

test("Test DeepInfraEmbeddings concurrency", async () => {
  const embeddings = new DeepInfraEmbeddings({
    batchSize: 1,
  });
  const res = await embeddings.embedDocuments([
    "Hello world",
    "Bye bye",
    "we need",
    "at least",
    "six documents",
    "to test concurrency",
  ]);
  expect(res).toHaveLength(6);
  expect(res.find((embedding) => typeof embedding[0] !== "number")).toBe(
    undefined
  );
});
