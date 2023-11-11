import fs from "fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@jest/globals";
import { GoogleVertexAIMultimodalEmbeddings } from "../googlevertexai.js";
import { Document } from "../../../document.js";
import { FaissStore } from "../../../vectorstores/faiss.js";

test.skip("embedding text", async () => {
  const e = new GoogleVertexAIMultimodalEmbeddings();

  const vector: number[] = await e.embedQuery("test 1");
  expect(vector).toHaveLength(1408);
  console.log(vector);
});

test.skip("embedding multiple texts", async () => {
  const e = new GoogleVertexAIMultimodalEmbeddings();

  const docs = ["test 1", "test 2"];
  const vector: number[][] = await e.embedDocuments(docs);
  expect(vector).toHaveLength(2);
  expect(vector[0]).toHaveLength(1408);
  expect(vector[1]).toHaveLength(1408);
  console.log(vector);
});

test.skip("embedding image", async () => {
  const e = new GoogleVertexAIMultimodalEmbeddings();

  const pathname = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "files",
    "parrot.jpeg"
  );
  const img = fs.readFileSync(pathname);
  const vector: number[] = await e.embedImageQuery(img);
  expect(vector).toHaveLength(1408);
  console.log(vector);
});

test.skip("embedding image with text in a vector store", async () => {
  const e = new GoogleVertexAIMultimodalEmbeddings();

  const vectorStore = await FaissStore.fromTexts(
    ["dog", "cat", "horse", "seagull"],
    [{ id: 2 }, { id: 1 }, { id: 3 }, { id: 4 }],
    e
  );

  const resultOne = await vectorStore.similaritySearch("bird", 2);
  console.log(resultOne);

  const pathname = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "files",
    "parrot.jpeg"
  );
  const img = fs.readFileSync(pathname);
  const vector: number[] = await e.embedImageQuery(img);
  const document = new Document({
    pageContent: img.toString("base64"),
    metadata: {
      id: 5,
      mediaType: "image",
    },
  });

  await vectorStore.addVectors([vector], [document]);

  const pathname2 = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "files",
    "parrot-icon.png"
  );
  const img2 = fs.readFileSync(pathname2);
  const vector2: number[] = await e.embedImageQuery(img2);

  const resultTwo = await vectorStore.similaritySearchVectorWithScore(
    vector2,
    2
  );
  console.log(resultTwo);
});
