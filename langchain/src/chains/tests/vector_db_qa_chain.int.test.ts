import { test } from "@jest/globals";
import { OpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { Document } from "@langchain/core/documents";
import { LLMChain } from "../llm_chain.js";
import { StuffDocumentsChain } from "../combine_docs_chain.js";
import { VectorDBQAChain } from "../vector_db_qa.js";
import { MemoryVectorStore } from "../../vectorstores/memory.js";

test("Test VectorDBQAChain", async () => {
  const model = new OpenAI({ modelName: "gpt-3.5-turbo-instruct" });
  const prompt = new PromptTemplate({
    template: "Print {foo}",
    inputVariables: ["foo"],
  });
  const vectorStore = await MemoryVectorStore.fromTexts(
    ["Hello world", "Bye bye", "hello nice world", "bye", "hi"],
    [{ id: 2 }, { id: 1 }, { id: 3 }, { id: 4 }, { id: 5 }],
    new OpenAIEmbeddings()
  );
  const llmChain = new LLMChain({ prompt, llm: model });
  const combineDocsChain = new StuffDocumentsChain({
    llmChain,
    documentVariableName: "foo",
  });
  const chain = new VectorDBQAChain({
    combineDocumentsChain: combineDocsChain,
    vectorstore: vectorStore,
  });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chain.call({ query: "What up" });
  // console.log({ res });
});

test("Test VectorDBQAChain from LLM", async () => {
  const model = new OpenAI({ modelName: "gpt-3.5-turbo-instruct" });
  const vectorStore = await MemoryVectorStore.fromTexts(
    ["Hello world", "Bye bye", "hello nice world", "bye", "hi"],
    [{ id: 2 }, { id: 1 }, { id: 3 }, { id: 4 }, { id: 5 }],
    new OpenAIEmbeddings()
  );
  const chain = VectorDBQAChain.fromLLM(model, vectorStore);
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chain.call({ query: "What up" });
  // console.log({ res });
});

test("Test VectorDBQAChain from LLM with a filter function", async () => {
  const model = new OpenAI({ modelName: "gpt-3.5-turbo-instruct" });
  const vectorStore = await MemoryVectorStore.fromTexts(
    ["Hello world", "Bye bye", "hello nice world", "bye", "hi"],
    [{ id: 2 }, { id: 1 }, { id: 3 }, { id: 4 }, { id: 5 }],
    new OpenAIEmbeddings()
  );
  const chain = VectorDBQAChain.fromLLM(model, vectorStore, {
    returnSourceDocuments: true,
  });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chain.call({
    query: "What up",
    filter: (document: Document) => document.metadata.id === 3,
  });
  // console.log({ res, sourceDocuments: res.sourceDocuments });
});
