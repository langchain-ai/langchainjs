import { test, expect } from "@jest/globals";
import { OpenAIEmbeddings } from "@langchain/openai";
import { VectorStoreRetrieverMemory } from "../vector_store.js";
import { MemoryVectorStore } from "../../vectorstores/memory.js";
import { Document } from "../../document.js";

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
