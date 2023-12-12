import { test, expect } from "@jest/globals";
import { GoogleVertexAIEmbeddings } from "../googlevertexai.js";
import { HNSWLib } from "../../vectorstores/hnswlib.js";

test("Test GoogleVertexAIEmbeddings.embedQuery", async () => {
  const embeddings = new GoogleVertexAIEmbeddings();
  const res = await embeddings.embedQuery("Hello world");
  console.log(res);
  expect(typeof res[0]).toBe("number");
});

test("Test GoogleVertexAIEmbeddings.embedDocuments", async () => {
  const embeddings = new GoogleVertexAIEmbeddings();
  const res = await embeddings.embedDocuments([
    "Hello world",
    "Bye bye",
    "we need",
    "at least",
    "six documents",
    "to test pagination",
  ]);
  console.log(res);
  expect(res).toHaveLength(6);
  res.forEach((r) => {
    expect(typeof r[0]).toBe("number");
  });
});

test("Test end to end with HNSWLib", async () => {
  const vectorStore = await HNSWLib.fromTexts(
    ["Hello world", "Bye bye", "hello nice world"],
    [{ id: 2 }, { id: 1 }, { id: 3 }],
    new GoogleVertexAIEmbeddings()
  );
  expect(vectorStore.index?.getCurrentCount()).toBe(3);

  const resultOne = await vectorStore.similaritySearch("hello world", 1);
  const resultOneMetadatas = resultOne.map(({ metadata }) => metadata);
  expect(resultOneMetadatas).toEqual([{ id: 2 }]);

  const resultTwo = await vectorStore.similaritySearch("hello world", 2);
  const resultTwoMetadatas = resultTwo.map(({ metadata }) => metadata);
  expect(resultTwoMetadatas).toEqual([{ id: 2 }, { id: 3 }]);

  const resultThree = await vectorStore.similaritySearch("hello world", 3);
  const resultThreeMetadatas = resultThree.map(({ metadata }) => metadata);
  expect(resultThreeMetadatas).toEqual([{ id: 2 }, { id: 3 }, { id: 1 }]);
});
