import { test } from "@jest/globals";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { StringOutputParser } from "@langchain/core/output_parsers";
import {
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { MemoryVectorStore } from "../../vectorstores/memory.js";
import { createHistoryAwareRetriever } from "../history_aware_retriever.js";
import { createRetrievalChain } from "../retrieval.js";

const QUESTION_GEN_TEMPLATE = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.

Chat History:
{chat_history}
Follow Up Input: {input}
Standalone question:`;

const COMBINE_DOCS_PROMPT = `Based on the following context:

{context}

And chat history:
{chat_history}

Answer the following question:
{input}`;

test("Retrieval chain with a history aware retriever and a followup", async () => {
  const questionGenPrompt = ChatPromptTemplate.fromTemplate(
    QUESTION_GEN_TEMPLATE
  );
  const vectorstore = await MemoryVectorStore.fromTexts(
    [
      "Mitochondria is the powerhouse of the cell",
      "Foo is red",
      "Bar is red",
      "Buildings are made out of brick",
      "Mitochondria are made of lipids",
    ],
    [{ id: 2 }, { id: 1 }, { id: 3 }, { id: 4 }, { id: 5 }],
    new OpenAIEmbeddings()
  );
  const retriever = vectorstore.asRetriever(2);
  const llm = new ChatOpenAI({});
  const historyAwareRetriever = await createHistoryAwareRetriever({
    llm,
    retriever,
    rephrasePrompt: questionGenPrompt,
  });
  const combineDocsPrompt =
    ChatPromptTemplate.fromTemplate(COMBINE_DOCS_PROMPT);
  const combineDocsChain = RunnableSequence.from([
    RunnablePassthrough.assign({
      context: (input: { context: Document[] }) =>
        input.context.map((doc) => doc.pageContent).join("\n\n"),
    }),
    combineDocsPrompt,
    llm,
    new StringOutputParser(),
  ]);
  const chain = await createRetrievalChain({
    retriever: historyAwareRetriever,
    combineDocsChain,
  });
  const results = await chain.invoke({
    input: "What is the powerhouse of the cell?",
    chat_history: "",
  });

  console.log(results);
  expect(results.answer.toLowerCase()).toContain("mitochondria");

  const results2 = await chain.invoke({
    input: "What are they made of?",
    extraparam: "unused",
    chat_history: [
      "Human: What is the powerhouse of the cell?",
      "Assistant: Mitochondria is the powerhouse of the cell",
    ].join("\n"),
  });
  console.log(results2);
  expect(results2.answer.toLowerCase()).toContain("lipids");
});
