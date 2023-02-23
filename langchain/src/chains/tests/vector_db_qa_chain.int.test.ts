import { test } from "@jest/globals";
import { OpenAI } from "../../llms/openai.js";
import { PromptTemplate } from "../../prompts/index.js";
import { LLMChain } from "../llm_chain.js";
import { loadChain } from "../load.js";
import { StuffDocumentsChain } from "../combine_docs_chain.js";
import { VectorDBQAChain } from "../vector_db_qa.js";
import { HNSWLib } from "../../vectorstores/hnswlib.js";
import { OpenAIEmbeddings } from "../../embeddings/index.js";

test("Test VectorDBQAChain", async () => {
  const model = new OpenAI({ modelName: "text-ada-001" });
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
  const model = new OpenAI({ modelName: "text-ada-001" });
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
