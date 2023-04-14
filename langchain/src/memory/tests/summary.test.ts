import { test } from "@jest/globals";
import { ConversationSummaryMemory } from "../summary.js";
import { OpenAIChat } from "../../llms/openai-chat.js";

test("Test summary memory", async () => {
  const memory = new ConversationSummaryMemory({
    llm: new OpenAIChat({ modelName: "gpt-3.5-turbo" }),
  });
  const result1 = await memory.loadMemoryVariables({});
  console.log("result1", result1);

  await memory.saveContext(
    { input: "How's it going?" },
    { response: "Hello! I'm doing fine. and you?" }
  );
  const result2 = await memory.loadMemoryVariables({});
  console.log("result2", result2);
});

test("Test summary memory return messages", async () => {
  const memory = new ConversationSummaryMemory({
    llm: new OpenAIChat({ modelName: "gpt-3.5-turbo" }),
    returnMessages: true,
  });
  const result1 = await memory.loadMemoryVariables({});
  console.log("result1", result1);

  await memory.saveContext(
    { input: "How's it going?" },
    { response: "Hello! I'm doing fine. and you?" }
  );
  const result2 = await memory.loadMemoryVariables({});
  console.log("result2", result2);
});
