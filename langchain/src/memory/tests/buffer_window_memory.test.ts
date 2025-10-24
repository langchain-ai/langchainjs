import { test, expect } from "@jest/globals";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { InMemoryChatMessageHistory as ChatMessageHistory } from "@langchain/core/chat_history";
import { BufferWindowMemory } from "../buffer_window_memory.js";

test("Test buffer window memory", async () => {
  const memory = new BufferWindowMemory({ k: 1 });
  const result1 = await memory.loadMemoryVariables({});
  expect(result1).toStrictEqual({ history: "" });

  await memory.saveContext({ foo: "bar" }, { bar: "foo" });
  const expectedString = "Human: bar\nAI: foo";
  const result2 = await memory.loadMemoryVariables({});
  expect(result2).toStrictEqual({ history: expectedString });

  await memory.saveContext({ foo: "bar1" }, { bar: "foo" });
  const expectedString3 = "Human: bar1\nAI: foo";
  const result3 = await memory.loadMemoryVariables({});
  expect(result3).toStrictEqual({ history: expectedString3 });
});

test("Test buffer window memory return messages", async () => {
  const memory = new BufferWindowMemory({ k: 1, returnMessages: true });
  const result1 = await memory.loadMemoryVariables({});
  expect(result1).toStrictEqual({ history: [] });

  await memory.saveContext({ foo: "bar" }, { bar: "foo" });
  const expectedResult = [new HumanMessage("bar"), new AIMessage("foo")];
  const result2 = await memory.loadMemoryVariables({});
  expect(result2).toStrictEqual({ history: expectedResult });

  await memory.saveContext({ foo: "bar1" }, { bar: "foo" });
  const expectedResult2 = [new HumanMessage("bar1"), new AIMessage("foo")];
  const result3 = await memory.loadMemoryVariables({});
  expect(result3).toStrictEqual({ history: expectedResult2 });
});

test("Test buffer window memory with pre-loaded history", async () => {
  const pastMessages = [
    new HumanMessage("My name's Jonas"),
    new AIMessage("Nice to meet you, Jonas!"),
  ];
  const memory = new BufferWindowMemory({
    returnMessages: true,
    chatHistory: new ChatMessageHistory(pastMessages),
  });
  const result = await memory.loadMemoryVariables({});
  expect(result).toStrictEqual({ history: pastMessages });
});
