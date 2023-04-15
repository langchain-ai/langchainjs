test("Test entity memory", async () => {
  const memory = new EntityMemory();
  const result1 = await memory.loadMemoryVariables({});
  expect(result1).toStrictEqual({ history: "" });

  await memory.saveContext({ foo: "bar" }, { bar: "foo" });
  const expectedString = "Human: bar\nAI: foo";
  const result2 = await memory.loadMemoryVariables({});
  expect(result2).toStrictEqual({ history: expectedString });
});
