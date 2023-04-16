import { test, expect } from "@jest/globals";
import { Document } from "document.js";
import { FakeEmbeddings } from "../../embeddings/fake.js";
import { VectorStore } from "../base.js";

class MockVectorStore extends VectorStore {
  mockedSimilaritySearchVectorWithScore: [
    Document<Record<string, number>>,
    number
  ][] = [
    [{ metadata: { id: 1 }, pageContent: "hello world1" }, 0.7],
    [{ metadata: { id: 2 }, pageContent: "hello world2" }, 0.5],
    [{ metadata: { id: 3 }, pageContent: "hello world3" }, 0.1],
  ];

  async addVectors(
    _vectors: number[][],
    _documents: Document<Record<string, number>>[]
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async addDocuments(
    _documents: Document<Record<string, number>>[]
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async similaritySearchVectorWithScore(
    _query: number[],
    k: number,
    _filter?: object | undefined
  ): Promise<[Document<Record<string, number>>, number][]> {
    return this.mockedSimilaritySearchVectorWithScore.slice(0, k);
  }
}

test("Test VectorStore.similaritySearch", async () => {
  const vectorStore = new MockVectorStore(new FakeEmbeddings(), []);

  const resultOne = await vectorStore.similaritySearch("hello world", 1);
  const resultOneMetadatas = resultOne.map(({ metadata }) => metadata);
  expect(resultOneMetadatas).toEqual([{ id: 1 }]);

  const resultTwo = await vectorStore.similaritySearch("hello world", 3);
  const resultTwoMetadatas = resultTwo.map(({ metadata }) => metadata);
  expect(resultTwoMetadatas).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);

  const resultThree = await vectorStore.similaritySearch(
    "hello world",
    3,
    undefined,
    0.5
  );
  const resultThreeMetadatas = resultThree.map(({ metadata }) => metadata);
  expect(resultThreeMetadatas).toEqual([{ id: 1 }, { id: 2 }]);
});
