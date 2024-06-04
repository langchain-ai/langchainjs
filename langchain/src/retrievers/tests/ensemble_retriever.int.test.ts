import { expect, test } from "@jest/globals";
import { CohereEmbeddings } from "@langchain/cohere";
import { MemoryVectorStore } from "../../vectorstores/memory.js";
import { EnsembleRetriever } from "../ensemble.js";

test("Should work with a question input", async () => {
  const vectorstore = await MemoryVectorStore.fromTexts(
    [
      "Buildings are made out of brick",
      "Buildings are made out of wood",
      "Buildings are made out of stone",
      "Cars are made out of metal",
      "Cars are made out of plastic",
      "mitochondria is the powerhouse of the cell",
      "mitochondria is made of lipids",
    ],
    [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }],
    new CohereEmbeddings()
  );
  const retriever = new EnsembleRetriever({
    retrievers: [vectorstore.asRetriever()],
  });

  const query = "What are mitochondria made of?";
  const retrievedDocs = await retriever.invoke(query);
  expect(retrievedDocs[0].pageContent).toContain("mitochondria");
});

test("Should work with multiple retriever", async () => {
  const vectorstore = await MemoryVectorStore.fromTexts(
    [
      "Buildings are made out of brick",
      "Buildings are made out of wood",
      "Buildings are made out of stone",
      "Cars are made out of metal",
      "Cars are made out of plastic",
      "mitochondria is the powerhouse of the cell",
      "mitochondria is made of lipids",
    ],
    [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }],
    new CohereEmbeddings()
  );
  const vectorstore2 = await MemoryVectorStore.fromTexts(
    [
      "Buildings are made out of brick",
      "Buildings are made out of wood",
      "Buildings are made out of stone",
      "Cars are made out of metal",
      "Cars are made out of plastic",
      "mitochondria is the powerhouse of the cell",
      "mitochondria is made of lipids",
    ],
    [{ id: 6 }, { id: 7 }, { id: 8 }, { id: 9 }, { id: 10 }],
    new CohereEmbeddings()
  );
  const retriever = new EnsembleRetriever({
    retrievers: [vectorstore.asRetriever(), vectorstore2.asRetriever()],
  });

  const query = "cars";
  const retrievedDocs = await retriever.invoke(query);
  expect(
    retrievedDocs.filter((item) => item.pageContent.includes("Cars")).length
  ).toBe(2);
});

test("Should work with weights", async () => {
  const vectorstore = await MemoryVectorStore.fromTexts(
    [
      "Buildings are made out of brick",
      "Buildings are made out of wood",
      "Buildings are made out of stone",
      "Cars are made out of metal",
      "Cars are made out of plastic",
      "mitochondria is the powerhouse of the cell",
      "mitochondria is made of lipids",
    ],
    [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }],
    new CohereEmbeddings()
  );
  const vectorstore2 = await MemoryVectorStore.fromTexts(
    [
      "Buildings are made out of brick",
      "Buildings are made out of wood",
      "Buildings are made out of stone",
      "Cars are made out of metal",
      "Cars are made out of plastic",
      "mitochondria is the powerhouse of the cell",
      "mitochondria is made of lipids",
    ],
    [{ id: 6 }, { id: 7 }, { id: 8 }, { id: 9 }, { id: 10 }],
    new CohereEmbeddings()
  );
  const retriever = new EnsembleRetriever({
    retrievers: [vectorstore.asRetriever(), vectorstore2.asRetriever()],
    weights: [0.5, 0.9],
  });

  const query = "cars";
  const retrievedDocs = await retriever.invoke(query);
  expect(
    retrievedDocs.filter((item) => item.pageContent.includes("Cars")).length
  ).toBe(2);
});
