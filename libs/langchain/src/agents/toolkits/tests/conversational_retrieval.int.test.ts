import { test } from "@jest/globals";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { MemoryVectorStore } from "../../../vectorstores/memory.js";
import { createConversationalRetrievalAgent } from "../conversational_retrieval/openai_functions.js";
import { createRetrieverTool } from "../conversational_retrieval/tool.js";

test("Test ConversationalRetrievalAgent", async () => {
  const vectorStore = await MemoryVectorStore.fromTexts(
    [
      "LangCo made $10000 in July",
      "LangCo made $20 in August",
      "Foo is red",
      "Bar is red",
      "Buildings are made out of brick",
      "Mitochondria is the powerhouse of the cell",
    ],
    [{ id: 2 }, { id: 1 }, { id: 3 }, { id: 4 }, { id: 5 }],
    new OpenAIEmbeddings()
  );
  const llm = new ChatOpenAI({
    model: "gpt-4o-mini",
  });
  const tools = [
    createRetrieverTool(vectorStore.asRetriever(), {
      name: "search_LangCo_knowledge",
      description: "Searches for and returns documents regarding LangCo",
    }),
  ];
  const executor = await createConversationalRetrievalAgent(llm, tools, {
    verbose: true,
  });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const result = await executor.invoke({
    input: "Hi, I'm Bob!",
  });
  // console.log(result);
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const result2 = await executor.invoke({
    input: "What's my name?",
  });
  // console.log(result2);
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const result3 = await executor.invoke({
    input: "How much money did LangCo make in July?",
  });
  // console.log(result3);
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const result4 = await executor.invoke({
    input: "How about in August?",
  });
  // console.log(result4);
});
