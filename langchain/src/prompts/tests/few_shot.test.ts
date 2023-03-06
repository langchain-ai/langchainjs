import { expect, test } from "@jest/globals";
import { FewShotPromptTemplate } from "../few_shot.js";
import { PromptTemplate } from "../prompt.js";

test("Test using partial", async () => {
  const examplePrompt = PromptTemplate.fromTemplate("{foo}{bar}");
  const prompt = new FewShotPromptTemplate({
    prefix: "{foo}{bar}",
    examples: [],
    suffix: "",
    templateFormat: "f-string",
    exampleSeparator: "\n",
    examplePrompt,
    inputVariables: ["foo"],
    partialVariables: { bar: "baz" },
  });
  expect(await prompt.format({ foo: "foo" })).toBe("foobaz\n");
});

test("Test using full partial", async () => {
  const examplePrompt = PromptTemplate.fromTemplate("{foo}{bar}");
  const prompt = new FewShotPromptTemplate({
    prefix: "{foo}{bar}",
    examples: [],
    suffix: "",
    templateFormat: "f-string",
    exampleSeparator: "\n",
    examplePrompt,
    inputVariables: [],
    partialVariables: { bar: "baz", foo: "boo" },
  });
  expect(await prompt.format({})).toBe("boobaz\n");
});

test("Test partial with string", async () => {
  const examplePrompt = PromptTemplate.fromTemplate("{foo}{bar}");
  const prompt = new FewShotPromptTemplate({
    prefix: "{foo}{bar}",
    examples: [],
    suffix: "",
    templateFormat: "f-string",
    exampleSeparator: "\n",
    examplePrompt,
    inputVariables: ["foo", "bar"],
  });

  const partialPrompt = await prompt.partial({ foo: "foo" });
  expect(await partialPrompt.format({ bar: "baz" })).toBe("foobaz\n");
  expect(prompt.inputVariables).toEqual(["foo", "bar"]);
});

test("Test partial with function", async () => {
  const examplePrompt = PromptTemplate.fromTemplate("{foo}{bar}");
  const prompt = new FewShotPromptTemplate({
    prefix: "{foo}{bar}",
    examples: [],
    suffix: "",
    templateFormat: "f-string",
    exampleSeparator: "\n",
    examplePrompt,
    inputVariables: ["foo", "bar"],
  });

  const partialPrompt = await prompt.partial({
    foo: () => Promise.resolve("boo"),
  });
  expect(await partialPrompt.format({ bar: "baz" })).toBe("boobaz\n");
});

test("Test partial with function and examples", async () => {
  const examplePrompt = PromptTemplate.fromTemplate("An example about {x}");
  const prompt = new FewShotPromptTemplate({
    prefix: "{foo}{bar}",
    examples: [{ x: "foo" }, { x: "bar" }],
    suffix: "",
    templateFormat: "f-string",
    exampleSeparator: "\n",
    examplePrompt,
    inputVariables: ["foo", "bar"],
  });

  const partialPrompt = await prompt.partial({
    foo: () => Promise.resolve("boo"),
  });
  expect(await partialPrompt.format({ bar: "baz" })).toBe(
    `boobaz
An example about foo
An example about bar
`
  );
});
