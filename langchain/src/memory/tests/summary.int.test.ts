import { test, expect } from "@jest/globals";
import { ConversationSummaryMemory } from "../summary.js";
import { OpenAIChat } from "../../llms/openai-chat.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { SystemMessage } from "../../schema/index.js";

test("Test summary memory", async () => {
  const memory = new ConversationSummaryMemory({
    llm: new OpenAIChat({ modelName: "gpt-3.5-turbo", temperature: 0 }),
  });
  expect(await memory.loadMemoryVariables({})).toEqual({
    history: "",
  });

  await memory.saveContext(
    { input: "How's it going?" },
    { response: "Hello! I'm doing fine. and you?" }
  );
  const result2 = await memory.loadMemoryVariables({});
  console.log("result2", result2);

  await memory.clear();
  expect(await memory.loadMemoryVariables({})).toEqual({
    history: "",
  });
});

test("Test summary memory with chat model", async () => {
  const memory = new ConversationSummaryMemory({
    llm: new ChatOpenAI({ temperature: 0 }),
  });
  expect(await memory.loadMemoryVariables({})).toEqual({
    history: "",
  });

  await memory.saveContext(
    { input: "How's it going?" },
    { response: "Hello! I'm doing fine. and you?" }
  );
  const result2 = await memory.loadMemoryVariables({});
  console.log("result2", result2);

  await memory.clear();
  expect(await memory.loadMemoryVariables({})).toEqual({
    history: "",
  });
});

test("Test summary memory return messages", async () => {
  const memory = new ConversationSummaryMemory({
    llm: new OpenAIChat({ modelName: "gpt-3.5-turbo", temperature: 0 }),
    returnMessages: true,
  });
  expect(await memory.loadMemoryVariables({})).toEqual({
    history: [new SystemMessage("")],
  });

  await memory.saveContext(
    { input: "How's it going?" },
    { response: "Hello! I'm doing fine. and you?" }
  );
  const result2 = await memory.loadMemoryVariables({});
  console.log("result2", result2);

  await memory.clear();
  expect(await memory.loadMemoryVariables({})).toEqual({
    history: [new SystemMessage("")],
  });
});
