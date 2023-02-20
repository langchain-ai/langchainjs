import { test } from "@jest/globals";
import { OpenAI } from "../../llms/openai";
import { PromptTemplate } from "../../prompts";
import { LLMChain } from "../llm_chain";
import { loadChain } from "../load";
import { StuffDocumentsChain } from "../combine_docs_chain";
import { VectorDBQAChain } from "../vector_db_qa";
import { HNSWLib } from "../../vectorstores/hnswlib";
import { OpenAIEmbeddings } from "../../embeddings";

test("Test VectorDBQAChain", async () => {
  const model = new OpenAI({});
  const prompt = new PromptTemplate({
    template: "Print {foo}",
    inputVariables: ["foo"],
  });
  const vectorStore = await HNSWLib.fromTexts(
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
  const res = await chain.call({ query: "What up" });
  console.log({ res });
});

test("Test VectorDBQAChain from LLM", async () => {
  const model = new OpenAI({});
  const vectorStore = await HNSWLib.fromTexts(
    ["Hello world", "Bye bye", "hello nice world", "bye", "hi"],
    [{ id: 2 }, { id: 1 }, { id: 3 }, { id: 4 }, { id: 5 }],
    new OpenAIEmbeddings()
  );
  const chain = VectorDBQAChain.fromLLM(model, vectorStore);
  const res = await chain.call({ query: "What up" });
  console.log({ res });
});

test("Load chain from hub", async () => {
  const vectorStore = await HNSWLib.fromTexts(
    ["Hello world", "Bye bye", "hello nice world", "bye", "hi"],
    [{ id: 2 }, { id: 1 }, { id: 3 }, { id: 4 }, { id: 5 }],
    new OpenAIEmbeddings()
  );
  const chain = await loadChain("lc://chains/vector-db-qa/stuff/chain.json", {
    vectorstore: vectorStore,
  });
  const res = await chain.call({ query: "what up" });
  console.log({ res });
});
