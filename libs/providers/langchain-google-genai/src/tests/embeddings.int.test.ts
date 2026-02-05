import { test, expect } from "@jest/globals";
import { GoogleGenerativeAIEmbeddings } from "../embeddings.js";

test("Test GooglePalmEmbeddings.embedQuery", async () => {
  const embeddings = new GoogleGenerativeAIEmbeddings({
    maxRetries: 1,
  });
  const res = await embeddings.embedQuery("Hello world");
  // console.log(res);
  expect(typeof res[0]).toBe("number");
});

test("Test GooglePalmEmbeddings.embedDocuments", async () => {
  const embeddings = new GoogleGenerativeAIEmbeddings({
    maxRetries: 1,
  });
  const res = await embeddings.embedDocuments([
    "Hello world",
    "Bye bye",
    "we need",
    "at least",
    "six documents",
    "to test pagination",
  ]);
  // console.log(res);
  expect(res).toHaveLength(6);
  res.forEach((r) => {
    expect(typeof r[0]).toBe("number");
  });
});

test("Test GooglePalmEmbeddings.embedQuery with baseUrl set", async () => {
  const embeddings = new GoogleGenerativeAIEmbeddings({
    maxRetries: 1,
    baseUrl: "https://generativelanguage.googleapis.com",
  });
  const res = await embeddings.embedQuery("Hello world");
  // console.log(res);
  expect(typeof res[0]).toBe("number");
});

test("Test GooglePalmEmbeddings.embedDocuments with baseUrl set", async () => {
  const embeddings = new GoogleGenerativeAIEmbeddings({
    maxRetries: 1,
    baseUrl: "https://generativelanguage.googleapis.com",
  });
  const res = await embeddings.embedDocuments([
    "Hello world",
    "Bye bye",
    "we need",
    "at least",
    "six documents",
    "to test pagination",
  ]);
  // console.log(res);
  expect(res).toHaveLength(6);
  res.forEach((r) => {
    expect(typeof r[0]).toBe("number");
  });
});
