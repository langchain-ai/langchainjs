import { test, expect, jest } from "@jest/globals";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { MotorheadMemory } from "../motorhead_memory.js";

test("Test motörhead memory", async () => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      json: () =>
        Promise.resolve({
          messages: [
            { role: "Human", content: "Who is the best vocalist?" },
            { role: "AI", content: "Ozzy Osbourne" },
          ],
        }),
    } as Response)
  );

  const memory = new MotorheadMemory({ url: "localhost:8080", sessionId: "1" });
  const result1 = await memory.loadMemoryVariables({});
  expect(result1).toStrictEqual({ history: "" });

  await memory.saveContext(
    { input: "Who is the best vocalist?" },
    { response: "Ozzy Osbourne" }
  );
  const expectedString = "Human: Who is the best vocalist?\nAI: Ozzy Osbourne";
  const result2 = await memory.loadMemoryVariables({});
  expect(result2).toStrictEqual({ history: expectedString });
});

test("Test motörhead memory with pre-loaded history", async () => {
  const pastMessages = [
    new HumanMessage("My name is Ozzy"),
    new AIMessage("Nice to meet you, Ozzy!"),
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
    } as Response)
  );
  const memory = new MotorheadMemory({
    url: "localhost:8080",
    returnMessages: true,
    sessionId: "2",
  });
  await memory.init();
  const result = await memory.loadMemoryVariables({});
  expect(result).toStrictEqual({ history: pastMessages });
});
