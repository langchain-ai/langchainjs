import { expect, test } from "@jest/globals";
import { v4 as uuid } from "uuid";
import { AlchemystMemory } from "../alchemyst.js";

const apiKey = process.env.ALCHEMYST_API_KEY; // Set this in your env
if (!apiKey) {
  test.skip("AlchemystMemory integration tests skipped: no API key", () => {});
} else {
  test("AlchemystMemory: empty history initially", async () => {
    const sessionId = uuid();
    const memory = new AlchemystMemory({ apiKey, sessionId });
    const result = await memory.loadMemoryVariables({});
    expect(result).toStrictEqual({ history: "" });
  });

  test("AlchemystMemory: save and load context", async () => {
    const sessionId = uuid();
    const memory = new AlchemystMemory({ apiKey, sessionId });
    await memory.saveContext(
      { input: "Hi, my name is Jim" },
      { output: "Nice to meet you, Jim" }
    );
    // Wait a bit if the backend is eventually consistent
    await new Promise((r) => setTimeout(r, 1000));
    const result = await memory.loadMemoryVariables({});
    expect(result.history).toContain("Jim");
  });

  test("AlchemystMemory: clear memory", async () => {
    const sessionId = uuid();
    const memory = new AlchemystMemory({ apiKey, sessionId });
    await memory.saveContext(
      { input: "Hello" },
      { output: "Hi!" }
    );
    await memory.clear();
    // Wait a bit for clear to propagate
    await new Promise((r) => setTimeout(r, 500));
    const result = await memory.loadMemoryVariables({});
    expect(result).toStrictEqual({ history: "" });
  });
}
