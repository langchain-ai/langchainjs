import { test, expect } from "@jest/globals";
import { BaseLLM } from "llms/base.js";

import { LLMResult } from "../../schema/index.js";
import { EntityMemory } from "../entity_memory.js";

class FakeLLM extends BaseLLM {
  _llmType(): string {
    return "fake";
  }

  async _generate(prompts: string[], _?: string[]): Promise<LLMResult> {
    const mockVal = { generations: [[{ text: "foo" }]] };
    return mockVal;
  }
}

test("Test entity memory", async () => {
  const model = new FakeLLM({});
  const memory = new EntityMemory({ llm: model });
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
