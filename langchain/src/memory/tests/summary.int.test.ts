import { test, expect } from "@jest/globals";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage } from "@langchain/core/messages";
import { ConversationSummaryMemory } from "../summary.js";

test("Test summary memory", async () => {
  const memory = new ConversationSummaryMemory({
    llm: new ChatOpenAI({ modelName: "gpt-3.5-turbo", temperature: 0 }),
  });
  expect(await memory.loadMemoryVariables({})).toEqual({
    history: "",
  });

  await memory.saveContext(
    { input: "How's it going?" },
    { response: "Hello! I'm doing fine. and you?" }
  );
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const result2 = await memory.loadMemoryVariables({});
  // console.log("result2", result2);

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
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const result2 = await memory.loadMemoryVariables({});
  // console.log("result2", result2);

  await memory.clear();
  expect(await memory.loadMemoryVariables({})).toEqual({
    history: "",
  });
});

test("Test summary memory return messages", async () => {
  const memory = new ConversationSummaryMemory({
    llm: new ChatOpenAI({ modelName: "gpt-3.5-turbo", temperature: 0 }),
    returnMessages: true,
  });
  expect(await memory.loadMemoryVariables({})).toEqual({
    history: [new SystemMessage("")],
  });

  await memory.saveContext(
    { input: "How's it going?" },
    { response: "Hello! I'm doing fine. and you?" }
  );
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const result2 = await memory.loadMemoryVariables({});
  // console.log("result2", result2);

  await memory.clear();
  expect(await memory.loadMemoryVariables({})).toEqual({
    history: [new SystemMessage("")],
  });
});
