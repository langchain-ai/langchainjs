import { test } from "@jest/globals";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "../../vectorstores/memory.js";
import { createHistoryAwareRetriever } from "../history_aware_retriever.js";

const QUESTION_GEN_TEMPLATE = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.

Chat History:
{chat_history}
Follow Up Input: {input}
Standalone question:`;

test("History aware retriever with a followup", async () => {
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
  const chain = await createHistoryAwareRetriever({
    llm,
    retriever,
    rephrasePrompt: questionGenPrompt,
  });
  const outputDocs = await chain.invoke({
    input: "What is the powerhouse of the cell?",
    chat_history: "",
  });
  expect(outputDocs[0].pageContent).toBe(
    "Mitochondria is the powerhouse of the cell"
  );

  const outputDocs2 = await chain.invoke({
    input: "What are they made of?",
    chat_history: [
      "Human: What is the powerhouse of the cell?",
      "Assistant: Mitochondria is the powerhouse of the cell",
    ].join("\n"),
  });
  expect(outputDocs2[0].pageContent).toBe("Mitochondria are made of lipids");
});
