/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test, expect } from "@jest/globals";
import { MotorheadMemory } from "../motorhead_memory.js";

test("Test managed motörhead memory", async () => {
  const memory = new MotorheadMemory({
    sessionId: new Date().toISOString(),
    apiKey: process.env.METAL_API_KEY!,
    clientId: process.env.METAL_CLIENT_ID!,
  });
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
