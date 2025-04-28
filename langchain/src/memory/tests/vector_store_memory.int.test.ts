import { test, expect } from "@jest/globals";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { VectorStoreRetrieverMemory } from "../vector_store.js";
import { MemoryVectorStore } from "../../vectorstores/memory.js";

test("Test vector store memory", async () => {
  const vectorStore = new MemoryVectorStore(new OpenAIEmbeddings());
  const memory = new VectorStoreRetrieverMemory({
    vectorStoreRetriever: vectorStore.asRetriever(),
  });
  const result1 = await memory.loadMemoryVariables({ input: "foo" });
  expect(result1).toStrictEqual({ memory: "" });

  await memory.saveContext({ foo: "bar" }, { bar: "foo" });
  const expectedString = "foo: bar\nbar: foo";
  const result2 = await memory.loadMemoryVariables({ input: "foo" });
  expect(result2).toStrictEqual({ memory: expectedString });
});

test("Test vector store memory return docs", async () => {
  const vectorStore = new MemoryVectorStore(new OpenAIEmbeddings());
  const memory = new VectorStoreRetrieverMemory({
    vectorStoreRetriever: vectorStore.asRetriever(),
    returnDocs: true,
  });
  const result1 = await memory.loadMemoryVariables({ input: "foo" });
  expect(result1).toStrictEqual({ memory: [] });

  await memory.saveContext({ foo: "bar" }, { bar: "foo" });
  const expectedResult = [new Document({ pageContent: "foo: bar\nbar: foo" })];
  const result2 = await memory.loadMemoryVariables({ input: "foo" });
  expect(result2).toStrictEqual({ memory: expectedResult });
});

test("Test vector store memory metadata object", async () => {
  const vectorStore = new MemoryVectorStore(new OpenAIEmbeddings());
  const memory = new VectorStoreRetrieverMemory({
    vectorStoreRetriever: vectorStore.asRetriever(),
    metadata: { foo: "bar" },
  });

  await memory.saveContext({ foo: "bar" }, { bar: "foo" });
  vectorStore.memoryVectors.forEach((vector) => {
    expect(vector.metadata).toStrictEqual({ foo: "bar" });
  });
});

test("Test vector store memory metadata function", async () => {
  const vectorStore = new MemoryVectorStore(new OpenAIEmbeddings());

  const memory = new VectorStoreRetrieverMemory({
    vectorStoreRetriever: vectorStore.asRetriever(),
    metadata: (inputValues, outputValues) => ({
      foo: `${inputValues?.foo} ${inputValues?.foo}`, // "bar bar"
      bar: `${outputValues?.bar} ${outputValues?.bar}`, // "foo foo"
    }),
  });

  await memory.saveContext({ foo: "bar" }, { bar: "foo" });
  vectorStore.memoryVectors.forEach((vector) => {
    expect(vector.metadata).toStrictEqual({ foo: "bar bar", bar: "foo foo" });
  });
});
