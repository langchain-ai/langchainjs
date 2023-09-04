import { test } from "@jest/globals";
import { HNSWLib } from "../../../vectorstores/hnswlib.js";
import { OpenAIEmbeddings } from "../../../embeddings/openai.js";
import { createConversationalRetrievalAgent } from "../conversational_retrieval/openai_functions.js";
import { createRetrieverTool } from "../conversational_retrieval/tool.js";
import { ChatOpenAI } from "../../../chat_models/openai.js";

test("Test ConversationalRetrievalAgent", async () => {
  const vectorStore = await HNSWLib.fromTexts(
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
  const llm = new ChatOpenAI({});
  const tools = [
    createRetrieverTool(vectorStore.asRetriever(), {
      name: "search_LangCo_knowledge",
      description: "Searches for and returns documents regarding LangCo",
    }),
  ];
  const executor = await createConversationalRetrievalAgent(llm, tools, {
    verbose: true,
  });
  const result = await executor.invoke({
    input: "Hi, I'm Bob!",
  });
  console.log(result);
  const result2 = await executor.invoke({
    input: "What's my name?",
  });
  console.log(result2);
  const result3 = await executor.invoke({
    input: "How much money did LangCo make in July?",
  });
  console.log(result3);
  const result4 = await executor.invoke({
    input: "How about in August?",
  });
  console.log(result4);
});
