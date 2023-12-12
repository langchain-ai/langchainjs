import { test, expect } from "@jest/globals";
import { VoyageEmbeddings } from "../voyage.js";

test.skip("Test VoyageEmbeddings.embedQuery", async () => {
  const embeddings = new VoyageEmbeddings();
  const res = await embeddings.embedQuery("Hello world");

  expect(typeof res[0]).toBe("number");
});

test.skip("Test VoyageEmbeddings.embedDocuments", async () => {
  const embeddings = new VoyageEmbeddings();
  const res = await embeddings.embedDocuments(["Hello world", "Bye bye"]);
  expect(res).toHaveLength(2);
  expect(typeof res[0][0]).toBe("number");
  expect(typeof res[1][0]).toBe("number");
});

test.skip("Test VoyageEmbeddings concurrency", async () => {
  const embeddings = new VoyageEmbeddings({
    batchSize: 1,
    maxConcurrency: 2,
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
