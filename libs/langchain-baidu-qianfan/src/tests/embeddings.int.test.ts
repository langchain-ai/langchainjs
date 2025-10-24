import { test } from "@jest/globals";
import { BaiduQianfanEmbeddings } from "../embeddings.js";

test("embedQuery", async () => {
  const embeddings = new BaiduQianfanEmbeddings();
  const res = await embeddings.embedQuery("Introduce the city Beijing");
  // console.log({ res });
  expect(res.length).toBeGreaterThan(10);
});

test("embedDocuments", async () => {
  const embeddings = new BaiduQianfanEmbeddings();
  const res = await embeddings.embedDocuments(["Hello world", "Bye bye"]);
  // console.log({ res });
  expect(res.length).toBe(2);
});
