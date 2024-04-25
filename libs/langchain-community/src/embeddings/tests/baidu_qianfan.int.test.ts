import { test, expect } from "@jest/globals";
import { BaiduQianfanEmbeddings } from "../baidu_qianfan.js";

test.skip("Test BaiduQianfanEmbeddings.embedQuery", async () => {
  const embeddings = new BaiduQianfanEmbeddings();
  const res = await embeddings.embedQuery("Hello world");
  expect(typeof res[0]).toBe("number");
});

test.skip("Test BaiduQianfanEmbeddings.embedDocuments", async () => {
  const embeddings = new BaiduQianfanEmbeddings();
  const res = await embeddings.embedDocuments(["Hello world", "Bye bye"]);
  expect(res).toHaveLength(2);
  expect(typeof res[0][0]).toBe("number");
  expect(typeof res[1][0]).toBe("number");
});

test.skip("Test BaiduQianfanEmbeddings concurrency", async () => {
  const embeddings = new BaiduQianfanEmbeddings({
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
