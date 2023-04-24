import { expect, test } from "@jest/globals";
import { PromptTemplate } from "../prompt.js";

test("Test using partial", async () => {
  const prompt = new PromptTemplate({
    template: "{foo}{bar}",
    inputVariables: ["foo"],
    partialVariables: { bar: "baz" },
  });
  expect(await prompt.format({ foo: "foo" })).toBe("foobaz");
});

test("Test using full partial", async () => {
  const prompt = new PromptTemplate({
    template: "{foo}{bar}",
    inputVariables: [],
    partialVariables: { bar: "baz", foo: "boo" },
  });
  expect(await prompt.format({})).toBe("boobaz");
});

test("Test partial", async () => {
  const prompt = new PromptTemplate({
    template: "{foo}{bar}",
    inputVariables: ["foo", "bar"],
  });
  expect(prompt.inputVariables).toEqual(["foo", "bar"]);
  const partialPrompt = await prompt.partial({ foo: "foo" });
  // original prompt is not modified
  expect(prompt.inputVariables).toEqual(["foo", "bar"]);
  // partial prompt has only remaining variables
  expect(partialPrompt.inputVariables).toEqual(["bar"]);
  expect(await partialPrompt.format({ bar: "baz" })).toBe("foobaz");
});

test("Test partial with function", async () => {
  const prompt = new PromptTemplate({
    template: "{foo}{bar}",
    inputVariables: ["foo", "bar"],
  });
  const partialPrompt = await prompt.partial({
    foo: () => Promise.resolve("boo"),
  });
  expect(await partialPrompt.format({ bar: "baz" })).toBe("boobaz");
});
