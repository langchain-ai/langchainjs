import { test, expect } from "@jest/globals";
import { OpenAI } from "../../llms/openai.js";
import { ConversationTokenBufferMemory } from "../buffer_token_memory.js";
import { ChatMessageHistory } from "../../stores/message/in_memory.js";
import { HumanMessage, AIMessage } from "../../schema/index.js";

test("Test buffer token memory with LLM", async () => {
  const memory = new ConversationTokenBufferMemory({
    llm: new OpenAI(),
    maxTokenLimit: 10,
  });
  const result1 = await memory.loadMemoryVariables({});
  expect(result1).toStrictEqual({ history: "" });

  await memory.saveContext({ input: "foo" }, { output: "bar" });
  const expectedString = "Human: foo\nAI: bar";
  const result2 = await memory.loadMemoryVariables({});
  expect(result2).toStrictEqual({ history: expectedString });

  await memory.saveContext({ foo: "foo" }, { bar: "bar" });
  await memory.saveContext({ foo: "bar" }, { bar: "foo" });
  const expectedString3 = "Human: bar\nAI: foo";
  const result3 = await memory.loadMemoryVariables({});
  expect(result3).toStrictEqual({ history: expectedString3 });
});

test("Test buffer token memory return messages", async () => {
  const memory = new ConversationTokenBufferMemory({
    llm: new OpenAI(),
    returnMessages: true,
  });
  const result1 = await memory.loadMemoryVariables({});
  expect(result1).toStrictEqual({ history: [] });

  await memory.saveContext({ foo: "bar" }, { bar: "foo" });
  const expectedResult = [new HumanMessage("bar"), new AIMessage("foo")];
  const result2 = await memory.loadMemoryVariables({});
  expect(result2).toStrictEqual({ history: expectedResult });
});

test("Test buffer token memory with pre-loaded history", async () => {
  const pastMessages = [
    new HumanMessage("My name's Jonas"),
    new AIMessage("Nice to meet you, Jonas!"),
  ];
  const memory = new ConversationTokenBufferMemory({
    llm: new OpenAI(),
    returnMessages: true,
    chatHistory: new ChatMessageHistory(pastMessages),
  });
  const result = await memory.loadMemoryVariables({});
  expect(result).toStrictEqual({ history: pastMessages });
});
