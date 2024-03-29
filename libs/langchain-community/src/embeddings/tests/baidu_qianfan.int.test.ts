import { test, expect } from "@jest/globals";
import { BaiduQianFanEmbeddings } from "../baidu_qianfan.js";

test.skip("Test BaiduQianFanEmbeddings.embedQuery", async () => {
  const embeddings = new BaiduQianFanEmbeddings();
  const res = await embeddings.embedQuery("Hello world");
  expect(typeof res[0]).toBe("number");
});

test.skip("Test BaiduQianFanEmbeddings.embedDocuments", async () => {
  const embeddings = new BaiduQianFanEmbeddings();
  const res = await embeddings.embedDocuments(["Hello world", "Bye bye"]);
  expect(res).toHaveLength(2);
  expect(typeof res[0][0]).toBe("number");
  expect(typeof res[1][0]).toBe("number");
});

test.skip("Test BaiduQianFanEmbeddings concurrency", async () => {
  const embeddings = new BaiduQianFanEmbeddings({
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
