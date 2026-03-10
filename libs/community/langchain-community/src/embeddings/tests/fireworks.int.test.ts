import { test, expect } from "@jest/globals";
import { FireworksEmbeddings } from "../fireworks.js";

test.skip("Test FireworksEmbeddings.embedQuery", async () => {
  const embeddings = new FireworksEmbeddings();
  const res = await embeddings.embedQuery("Hello world");

  expect(typeof res[0]).toBe("number");
});

test.skip("Test FireworksEmbeddings.embedDocuments", async () => {
  const embeddings = new FireworksEmbeddings();
  const res = await embeddings.embedDocuments(["Hello world", "Bye bye"]);
  expect(res).toHaveLength(2);
  expect(typeof res[0][0]).toBe("number");
  expect(typeof res[1][0]).toBe("number");
});

test.skip("Test FireworksEmbeddings concurrency", async () => {
  const embeddings = new FireworksEmbeddings({
    batchSize: 1,
  });
  const res = await embeddings.embedDocuments([
    "Hello world",
    "Bye bye",
    "Hello world",
    "Bye bye",
    "Hello world",
    "Bye bye",
  ]);
  expect(res).toHaveLength(6);
  expect(res.find((embedding) => typeof embedding[0] !== "number")).toBe(
    undefined
  );
});
