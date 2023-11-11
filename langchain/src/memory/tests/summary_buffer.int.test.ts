import { test, expect } from "@jest/globals";
import { ConversationSummaryBufferMemory } from "../summary_buffer.js";
import { OpenAI } from "../../llms/openai.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { SystemMessage } from "../../schema/index.js";

test("Test summary buffer memory", async () => {
  const memory = new ConversationSummaryBufferMemory({
    llm: new OpenAI({ modelName: "gpt-3.5-turbo-instruct", temperature: 0 }),
    maxTokenLimit: 10,
  });
  expect(await memory.loadMemoryVariables({})).toEqual({
    history: "",
  });

  await memory.saveContext(
    { input: "How's it going?" },
    { response: "Hello! I'm doing fine. and you?" }
  );

  const result = await memory.loadMemoryVariables({});
  console.log("result", result);

  await memory.clear();
  expect(await memory.loadMemoryVariables({})).toEqual({
    history: "",
  });
});

test("Test summary buffer memory with chat model", async () => {
  const memory = new ConversationSummaryBufferMemory({
    llm: new ChatOpenAI({ temperature: 0 }),
    maxTokenLimit: 10,
  });
  expect(await memory.loadMemoryVariables({})).toEqual({
    history: "",
  });

  await memory.saveContext(
    { input: "How's it going?" },
    { response: "Hello! I'm doing fine. and you?" }
  );
  const result = await memory.loadMemoryVariables({});
  console.log("result", result);

  await memory.clear();
  expect(await memory.loadMemoryVariables({})).toEqual({
    history: "",
  });
});

test("Test summary buffer memory return messages", async () => {
  const memory = new ConversationSummaryBufferMemory({
    llm: new OpenAI({ modelName: "gpt-3.5-turbo-instruct", temperature: 0 }),
    returnMessages: true,
    maxTokenLimit: 10,
  });
  const exampleBuffer = "hello summary buffer";
  memory.movingSummaryBuffer = exampleBuffer;
  expect(await memory.loadMemoryVariables({})).toEqual({
    history: [new SystemMessage(exampleBuffer)],
  });

  await memory.saveContext(
    { input: "How's it going?" },
    { response: "Hello! I'm doing fine. and you?" }
  );

  const result = await memory.loadMemoryVariables({});
  console.log("result", result);

  await memory.clear();
  expect(await memory.loadMemoryVariables({})).toEqual({
    history: [],
  });
});
