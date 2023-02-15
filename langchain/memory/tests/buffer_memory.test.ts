import { test, expect } from "@jest/globals";
import { BufferMemory } from "../buffer_memory";

test("Test buffer memory", async () => {
  const memory = new BufferMemory();
  const result1 = await memory.loadMemoryVariables({});
  expect(result1).toStrictEqual({history: ""});
  memory.saveContext({foo: "bar"}, {bar: "foo"});
  const expectedString = "\nHuman: bar\nAI: foo";
  const result2 = await memory.loadMemoryVariables({});
  expect(result2).toStrictEqual({history: expectedString});
});
