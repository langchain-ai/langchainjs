import { test, expect } from "@jest/globals";
import { BasePromptValue } from "../../schema/index.js";
import { EntityMemory } from "../entity_memory.js";

test("Test entity memory", async () => {
  const mockLLM = {
    generatePrompt: (promptValues: BasePromptValue[], stop?: string[]) => {
      const mockVal = { generations: [[{ text: "foo" }]] };
      return mockVal;
    },
  };
  const memory = new EntityMemory({ llm: mockLLM });
  const result1 = await memory.loadMemoryVariables({ input: "foo" });
  const expectedResult1 = { history: "", entities: { foo: "" } };
  expect(result1).toStrictEqual(expectedResult1);

  await memory.saveContext({ foo: "bar" }, { bar: "foo" });
  const expectedString = "Human: bar\nAI: foo";
  const result2 = await memory.loadMemoryVariables({ input: "foo" });
  expect(result2).toStrictEqual({
    history: expectedString,
    entities: { foo: "foo" },
  });
});
