import { expect, test } from "@jest/globals";
import { PromptTemplate } from "../prompt.js";

test("Test using partial", async () => {
  const prompt = new PromptTemplate({
    template: "{foo}{bar}",
    inputVariables: ["foo"],
    partialVariables: { bar: "baz" },
  });
  expect(prompt.format({ foo: "foo" })).toBe("foobaz");
});

test("Test using full partial", async () => {
  const prompt = new PromptTemplate({
    template: "{foo}{bar}",
    inputVariables: [],
    partialVariables: { bar: "baz", foo: "boo" },
  });
  expect(prompt.format({})).toBe("boobaz");
});

test("Test partial", async () => {
  const prompt = new PromptTemplate({
    template: "{foo}{bar}",
    inputVariables: ["foo", "bar"],
  });
  const partialPrompt = await prompt.partial({ foo: "foo" });
  expect(partialPrompt.format({ bar: "baz" })).toBe("foobaz");
});

test("Test partial with function", async () => {
  const prompt = new PromptTemplate({
    template: "{foo}{bar}",
    inputVariables: ["foo", "bar"],
  });
  const partialPrompt = await prompt.partial({ foo: () => "boo" });
  expect(partialPrompt.format({ bar: "baz" })).toBe("boobaz");
});
