import { test, expect } from "@jest/globals";
import { BufferWindowMemory } from "../buffer_window_memory.js";
import { ChatMessageHistory } from "../../stores/message/in_memory.js";
import { HumanChatMessage, AIChatMessage } from "../../schema/index.js";

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
  const expectedResult = [
    new HumanChatMessage("bar"),
    new AIChatMessage("foo"),
  ];
  const result2 = await memory.loadMemoryVariables({});
  expect(result2).toStrictEqual({ history: expectedResult });

  await memory.saveContext({ foo: "bar1" }, { bar: "foo" });
  const expectedResult2 = [
    new HumanChatMessage("bar1"),
    new AIChatMessage("foo"),
  ];
  const result3 = await memory.loadMemoryVariables({});
  expect(result3).toStrictEqual({ history: expectedResult2 });
});

test("Test buffer window memory with pre-loaded history", async () => {
  const pastMessages = [
    new HumanChatMessage("My name's Jonas"),
    new AIChatMessage("Nice to meet you, Jonas!"),
  ];
  const memory = new BufferWindowMemory({
    returnMessages: true,
    chatHistory: new ChatMessageHistory(pastMessages),
  });
  const result = await memory.loadMemoryVariables({});
  expect(result).toStrictEqual({ history: pastMessages });
});
