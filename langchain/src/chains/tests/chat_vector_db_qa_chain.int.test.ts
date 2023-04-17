import { expect, test } from "@jest/globals";
import { OpenAI } from "../../llms/openai.js";
import { PromptTemplate } from "../../prompts/index.js";
import { LLMChain } from "../llm_chain.js";
import { StuffDocumentsChain } from "../combine_docs_chain.js";
import { ChatVectorDBQAChain } from "../chat_vector_db_chain.js";
import { HNSWLib } from "../../vectorstores/hnswlib.js";
import { OpenAIEmbeddings } from "../../embeddings/openai.js";

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
test("Test ChatVectorDBQAChain from LLM with flag option to return source", async () => {
  const model = new OpenAI({ modelName: "text-ada-001" });
  const vectorStore = await HNSWLib.fromTexts(
    ["Hello world", "Bye bye", "hello nice world", "bye", "hi"],
    [{ id: 2 }, { id: 1 }, { id: 3 }, { id: 4 }, { id: 5 }],
    new OpenAIEmbeddings()
  );
  const chain = ChatVectorDBQAChain.fromLLM(model, vectorStore, {
    returnSourceDocuments: true,
  });
  const res = await chain.call({ question: "foo", chat_history: "bar" });

  expect(res).toEqual(
    expect.objectContaining({
      text: expect.any(String),
      sourceDocuments: expect.arrayContaining([
        expect.objectContaining({
          metadata: expect.objectContaining({
            id: expect.any(Number),
          }),
          pageContent: expect.any(String),
        }),
      ]),
    })
  );
});

test("Test ChatVectorDBQAChain from LLM with override default prompts", async () => {
  const model = new OpenAI({ modelName: "text-ada-001", temperature: 0 });
  const vectorStore = await HNSWLib.fromTexts(
    ["Hello world", "Bye bye", "hello nice world", "bye", "hi"],
    [{ id: 2 }, { id: 1 }, { id: 3 }, { id: 4 }, { id: 5 }],
    new OpenAIEmbeddings()
  );

  const qa_template = `Use the following pieces of context to answer the question at the end. If you don't know the answer, just say "Sorry I dont know, I am learning from Aliens", don't try to make up an answer.
  {context}

  Question: {question}
  Helpful Answer:`;

  const chain = ChatVectorDBQAChain.fromLLM(model, vectorStore, {
    qaTemplate: qa_template,
  });
  const res = await chain.call({
    question: "What is better programming Language Python or Javascript ",
    chat_history: "bar",
  });
  expect(res.text).toContain("I am learning from Aliens");
  console.log({ res });
});
