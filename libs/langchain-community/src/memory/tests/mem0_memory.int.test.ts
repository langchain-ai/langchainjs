/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test, expect } from "@jest/globals";
import { randomUUID } from "crypto";
import { Mem0Memory } from "../mem0.js";

const sessionId = randomUUID(); // This should be unique for each user or each user's session.

test("Test managed mem0 memory", async () => {
  const memory = new Mem0Memory({
    sessionId,
    apiKey: process.env.MEM0_API_KEY!, // Get Mem0 API key from https://app.mem0.ai
  });
  const result1 = await memory.loadMemoryVariables({});
  // Empty Results as no context has been saved yet
  expect(result1).toStrictEqual({ history: "" });

  // Save Contex
  await memory.saveContext(
    { input: "Hi, my name is Jim" },
    { response: "Nice to meet you, Jim" }
  );

  const result2 = await memory.loadMemoryVariables({});
  const { history } = result2;
  expect(history).toContain("Jim");
});
