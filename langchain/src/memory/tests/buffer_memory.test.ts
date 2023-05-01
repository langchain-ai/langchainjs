import { test, expect } from "@jest/globals";
import { BufferMemory } from "../buffer_memory.js";
import { ChatMessageHistory } from "../../stores/message/in_memory.js";
import { HumanChatMessage, AIChatMessage } from "../../schema/index.js";

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
  const expectedResult = [
    new HumanChatMessage("bar"),
    new AIChatMessage("foo"),
  ];
  const result2 = await memory.loadMemoryVariables({});
  expect(result2).toStrictEqual({ history: expectedResult });
});

test("Test buffer memory with pre-loaded history", async () => {
  const pastMessages = [
    new HumanChatMessage("My name's Jonas"),
    new AIChatMessage("Nice to meet you, Jonas!"),
  ];
  const memory = new BufferMemory({
    returnMessages: true,
    chatHistory: new ChatMessageHistory(pastMessages),
  });
  const result = await memory.loadMemoryVariables({});
  expect(result).toStrictEqual({ history: pastMessages });
});
