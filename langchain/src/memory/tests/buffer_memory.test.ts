import { test, expect } from "@jest/globals";
import { BufferMemory } from "../buffer_memory.js";
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
