import fs from "fs";
import { test, xtest, expect } from "@jest/globals";
import { GoogleVertexAIImageEmbeddings } from "../googlevertexai_multimodal.js";

// eslint-disable-next-line no-process-env
const ifImgDefined = process.env.IMG_PATH ? test : xtest;

test("embedding text", async () => {
  const e = new GoogleVertexAIImageEmbeddings();

  const vector: number[] = await e.embedQuery("test 1");
  expect(vector).toHaveLength(1408);
  console.log(vector);
});

test("embedding multiple texts", async () => {
  const e = new GoogleVertexAIImageEmbeddings();

  const docs = ["test 1", "test 2"];
  const vector: number[][] = await e.embedDocuments(docs);
  expect(vector).toHaveLength(2);
  expect(vector[0]).toHaveLength(1408);
  expect(vector[1]).toHaveLength(1408);
  console.log(vector);
});

ifImgDefined("embedding image", async () => {
  const e = new GoogleVertexAIImageEmbeddings();

  // eslint-disable-next-line no-process-env
  const img = fs.readFileSync(process.env.IMG_PATH as string);
  const vector: number[] = await e.embedImageQuery(img);
  expect(vector).toHaveLength(1408);
  console.log(vector);
});
