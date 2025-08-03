import { test, expect } from "@jest/globals";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { InMemoryChatMessageHistory as ChatMessageHistory } from "@langchain/core/chat_history";
import { BufferMemory } from "../buffer_memory.js";

test("Test buffer memory", async () => {
  const memory = new BufferMemory();
  const result1 = await memory.loadMemoryVariables({});
  expect(result1).toStrictEqual({ history: "" });

  await memory.saveContext({ foo: "bar" }, { bar: "foo" });
  const expectedString = "Human: bar\nAI: foo";
  const result2 = await memory.loadMemoryVariables({});
  expect(result2).toStrictEqual({ history: expectedString });
});

test("Test buffer memory return messages", async () => {
  const memory = new BufferMemory({ returnMessages: true });
  const result1 = await memory.loadMemoryVariables({});
  expect(result1).toStrictEqual({ history: [] });

  await memory.saveContext({ foo: "bar" }, { bar: "foo" });
  const expectedResult = [new HumanMessage("bar"), new AIMessage("foo")];
  const result2 = await memory.loadMemoryVariables({});
  expect(result2).toStrictEqual({ history: expectedResult });
});

test("Test buffer memory with pre-loaded history", async () => {
  const pastMessages = [
    new HumanMessage("My name's Jonas"),
    new AIMessage("Nice to meet you, Jonas!"),
  ];
  const memory = new BufferMemory({
    returnMessages: true,
    chatHistory: new ChatMessageHistory(pastMessages),
  });
  const result = await memory.loadMemoryVariables({});
  expect(result).toStrictEqual({ history: pastMessages });
});
