import { test } from "@jest/globals";
import { OpenAI } from "../../llms/openai.js";
import { PromptTemplate } from "../../prompts/index.js";
import { LLMChain } from "../llm_chain.js";
import { StuffDocumentsChain } from "../combine_docs_chain.js";
import { ChatVectorDBQAChain } from "../chat_vector_db_chain.js";
import { HNSWLib } from "../../vectorstores/hnswlib.js";
import { OpenAIEmbeddings } from "../../embeddings/index.js";

test("Test ChatVectorDBQAChain", async () => {
  const model = new OpenAI({ modelName: "text-ada-001" });
  const prompt = PromptTemplate.fromTemplate(
    "Print {question}, and ignore {chat_history}"
  );
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
  const chain = new ChatVectorDBQAChain({
    combineDocumentsChain: combineDocsChain,
    vectorstore: vectorStore,
    questionGeneratorChain: llmChain,
  });
  const res = await chain.call({ question: "foo", chat_history: "bar" });
  console.log({ res });
});

test("Test ChatVectorDBQAChain with returnSourceDocuments", async () => {
  const model = new OpenAI({ modelName: "text-ada-001" });
  const prompt = PromptTemplate.fromTemplate(
    "Print {question}, and ignore {chat_history}"
  );
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
  const chain = new ChatVectorDBQAChain({
    combineDocumentsChain: combineDocsChain,
    vectorstore: vectorStore,
    questionGeneratorChain: llmChain,
    returnSourceDocuments: true,
  });
  const res = await chain.call({ question: "foo", chat_history: "bar" });
  console.log({ res });
});

test("Test ChatVectorDBQAChain from LLM", async () => {
  const model = new OpenAI({ modelName: "text-ada-001" });
  const vectorStore = await HNSWLib.fromTexts(
    ["Hello world", "Bye bye", "hello nice world", "bye", "hi"],
    [{ id: 2 }, { id: 1 }, { id: 3 }, { id: 4 }, { id: 5 }],
    new OpenAIEmbeddings()
  );
  const chain = ChatVectorDBQAChain.fromLLM(model, vectorStore);
  const res = await chain.call({ question: "foo", chat_history: "bar" });
  console.log({ res });
});
