import { test, expect, jest } from "@jest/globals";
import { MotorheadMemory } from "../motorhead_memory.js";
import { ChatMessageHistory } from "../chat_memory.js";
import { HumanChatMessage, AIChatMessage } from "../../schema/index.js";

test("Test motörhead memory", async () => {
  const memory = new MotorheadMemory();
  const result1 = await memory.loadMemoryVariables({});
  expect(result1).toStrictEqual({ history: "" });

  await memory.saveContext({ foo: "bar" }, { bar: "foo" });
  const expectedString = "Human: bar\nAI: foo";
  const result2 = await memory.loadMemoryVariables({});
  expect(result2).toStrictEqual({ history: expectedString });

  fetch.mockClear();
});

test("Test motörhead memory with pre-loaded history", async () => {
  const pastMessages = [
    new HumanChatMessage("My name's Jonas"),
    new AIChatMessage("Nice to meet you, Jonas!"),
  ];

  global.fetch = jest.fn(() =>
    Promise.resolve({
      json: () =>
        Promise.resolve({
          messages: [
            { role: "AI", content: "Nice to meet you, Ozzy!" },
            { role: "Human", content: "My name is Ozzy" },
          ],
        }),
    })
  );
  const memory = new MotorheadMemory({
    returnMessages: true,
  });
  await memory.init();
  const result = await memory.loadMemoryVariables({});
  expect(result).toStrictEqual({ history: pastMessages });
});
