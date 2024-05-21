import { test, expect } from "@jest/globals";
import { VoyageEmbeddings } from "../voyage.js";

test.skip("Test VoyageEmbeddings.embedQuery with input_type", async () => {
  const embeddings = new VoyageEmbeddings({ inputType: "document" });
  const res = await embeddings.embedQuery("Hello world");

  expect(typeof res[0]).toBe("number");
});

test.skip("Test VoyageEmbeddings.embedDocuments with input_type", async () => {
  const embeddings = new VoyageEmbeddings({ inputType: "document" });
  const res = await embeddings.embedDocuments(["Hello world", "Bye bye"]);
  expect(res).toHaveLength(2);
  expect(typeof res[0][0]).toBe("number");
  expect(typeof res[1][0]).toBe("number");
});

test.skip("Test VoyageEmbeddings concurrency with input_type", async () => {
  const embeddings = new VoyageEmbeddings({
    batchSize: 1,
    maxConcurrency: 2,
    inputType: "document",
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

test.skip("Test VoyageEmbeddings without input_type", async () => {
  const embeddings = new VoyageEmbeddings();
  const res = await embeddings.embedDocuments(["Hello world", "Bye bye"]);
  expect(res).toHaveLength(2);
  expect(typeof res[0][0]).toBe("number");
  expect(typeof res[1][0]).toBe("number");
});
