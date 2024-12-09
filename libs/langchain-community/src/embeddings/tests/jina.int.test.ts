import { test, expect } from "@jest/globals";
import { JinaEmbeddings } from "../jina.js";

test("Test JinaEmbeddings.embedQuery", async () => {
  const embeddings = new JinaEmbeddings();
  const res = await embeddings.embedQuery("Hello world");
  expect(typeof res[0]).toBe("number");
});

test("Test JinaEmbeddings.embedDocuments", async () => {
  const embeddings = new JinaEmbeddings();
  const res = await embeddings.embedDocuments(["Hello world", "Bye bye"]);
  expect(res).toHaveLength(2);
  expect(typeof res[0][0]).toBe("number");
  expect(typeof res[1][0]).toBe("number");
});

test("Test JinaEmbeddings concurrency", async () => {
  const embeddings = new JinaEmbeddings();
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

test("Test JinaEmbeddings embedImages", async () => {
  const embeddings = new JinaEmbeddings();
  const res = await embeddings.embedDocuments([
    { image: "https://avatars.githubusercontent.com/u/126733545?v=4" },
  ]);
  expect(typeof res[0][0]).toBe("number");
});
