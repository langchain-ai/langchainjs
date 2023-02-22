import { test, expect } from "@jest/globals";
import { BufferWindowMemory } from "../buffer_window_memory";
import { OutputValues } from "../base";

test("Test buffer memory", async () => {
  const memory = new BufferWindowMemory({ k: 1 });
  const result1 = await memory.loadMemoryVariables({});
  expect(result1).toStrictEqual({ history: "" });

  const llmResult = new Promise<OutputValues>((resolve, _reject) => {
    resolve({ bar: "foo" });
  });
  await memory.saveContext({ foo: "bar" }, llmResult);
  const expectedString = "\nHuman: bar\nAI: foo";
  const result2 = await memory.loadMemoryVariables({});
  expect(result2).toStrictEqual({ history: expectedString });

  const llmResult2 = new Promise<OutputValues>((resolve, _reject) => {
    resolve({ bar: "foo" });
  });
  await memory.saveContext({ foo: "bar1" }, llmResult2);
  const expectedString3 = "\nHuman: bar1\nAI: foo";
  const result3 = await memory.loadMemoryVariables({});
  expect(result3).toStrictEqual({ history: expectedString3 });
});
