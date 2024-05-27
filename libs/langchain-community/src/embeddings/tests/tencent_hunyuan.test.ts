import { test, expect } from "@jest/globals";
import { TencentHunyuanEmbeddings } from "../tencent_hunyuan/index.js";

test.skip("Test TencentHunyuanEmbeddings.embedQuery", async () => {
  const embeddings = new TencentHunyuanEmbeddings();
  const res = await embeddings.embedQuery("Hello world");
  expect(typeof res[0]).toBe("number");
});

test.skip("Test TencentHunyuanEmbeddings.embedDocuments", async () => {
  const embeddings = new TencentHunyuanEmbeddings();
  const res = await embeddings.embedDocuments(["Hello world", "Bye bye"]);
  expect(res).toHaveLength(2);
  expect(typeof res[0][0]).toBe("number");
  expect(typeof res[1][0]).toBe("number");
});

test.skip("Test TencentHunyuanEmbeddings concurrency", async () => {
  const embeddings = new TencentHunyuanEmbeddings();
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
