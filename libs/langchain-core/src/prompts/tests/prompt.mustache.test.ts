import { test, expect } from "vitest";
import { PromptTemplate } from "../prompt.js";
import { parseTemplate } from "../template.js";
import { MAX_PROMPT_TEMPLATE_DEPTH } from "../utils.js";

test("Single input variable.", async () => {
  const template = "This is a {{foo}} test.";
  const prompt = PromptTemplate.fromTemplate(template, {
    templateFormat: "mustache",
  });
  const formattedPrompt = await prompt.format({ foo: "bar" });
  expect(formattedPrompt).toBe("This is a bar test.");
  expect(prompt.inputVariables).toEqual(["foo"]);
});

test("Multiple input variables.", async () => {
  const template = "This {{bar}} is a {{foo}} test.";
  const prompt = PromptTemplate.fromTemplate(template, {
    templateFormat: "mustache",
  });
  const formattedPrompt = await prompt.format({ bar: "baz", foo: "bar" });
  expect(formattedPrompt).toBe("This baz is a bar test.");
  expect(prompt.inputVariables).toEqual(["bar", "foo"]);
});

test("Multiple input variables with repeats.", async () => {
  const template = "This {{bar}} is a {{foo}} test {{foo}}.";
  const prompt = PromptTemplate.fromTemplate(template, {
    templateFormat: "mustache",
  });
  const formattedPrompt = await prompt.format({ bar: "baz", foo: "bar" });
  expect(formattedPrompt).toBe("This baz is a bar test bar.");
  expect(prompt.inputVariables).toEqual(["bar", "foo"]);
});

test("Ignores f-string inputs input variables with repeats.", async () => {
  const template = "This {bar} is a {foo} test {foo}.";
  const prompt = PromptTemplate.fromTemplate(template, {
    templateFormat: "mustache",
  });
  const formattedPrompt = await prompt.format({ bar: "baz", foo: "bar" });
  expect(formattedPrompt).toBe("This {bar} is a {foo} test {foo}.");
  expect(prompt.inputVariables).toEqual([]);
});

test("Nested variables.", async () => {
  const template =
    "This {{obj.bar}} is a {{obj.foo}} test {{foo.bar.baz}}. Single: {{single}}";
  const prompt = PromptTemplate.fromTemplate(template, {
    templateFormat: "mustache",
  });
  const formattedPrompt = await prompt.format({
    obj: { bar: "foo", foo: "bar" },
    foo: {
      bar: {
        baz: "baz",
      },
    },
    single: "one",
  });
  expect(formattedPrompt).toBe("This foo is a bar test baz. Single: one");
  expect(prompt.inputVariables).toEqual(["obj", "foo", "single"]);
});

test("section/context variables", async () => {
  const template = `This{{#foo}}
{{bar}}
{{/foo}}is a test.`;
  const prompt = PromptTemplate.fromTemplate(template, {
    templateFormat: "mustache",
  });
  const formattedPrompt = await prompt.format({ foo: { bar: "yo" } });
  expect(formattedPrompt).toEqual(`This
yo
is a test.`);
  expect(prompt.inputVariables).toEqual(["foo", "bar"]);
});

test("section/context variables with repeats", async () => {
  const template = `This{{#foo}}
{{bar}}
{{/foo}}is a test.`;
  const promptWithRepeats = PromptTemplate.fromTemplate(template, {
    templateFormat: "mustache",
  });
  const formattedPrompt = await promptWithRepeats.format({
    foo: [{ bar: "yo" }, { bar: "hello" }],
  });
  expect(formattedPrompt).toEqual(`This
yo

hello
is a test.`);
  expect(promptWithRepeats.inputVariables).toEqual(["foo", "bar"]);
});

test("Escaped variables", async () => {
  const template = `test: {{{text}}}`;
  const parsed = parseTemplate(template, "mustache");
  expect(parsed[0]).toStrictEqual({
    type: "literal",
    text: "test: ",
  });
  expect(parsed[1]).toStrictEqual({
    type: "variable",
    name: "text",
  });

  const promptTemplate = PromptTemplate.fromTemplate(template, {
    templateFormat: "mustache",
  });
  const result = await promptTemplate.invoke({
    text: `hello i have a "quote`,
  });
  expect(result.value).toBe(`test: hello i have a "quote`);
});

test("Rejects deeply nested mustache sections", () => {
  const depth = MAX_PROMPT_TEMPLATE_DEPTH + 1;
  const template = "{{#dos}}".repeat(depth) + "x" + "{{/dos}}".repeat(depth);

  try {
    PromptTemplate.fromTemplate(template, {
      templateFormat: "mustache",
    });
    throw new Error("Expected template parsing to fail for deep nesting.");
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect((error as { lc_error_code?: string }).lc_error_code).toBe(
      "INVALID_PROMPT_INPUT"
    );
    expect((error as Error).message).toContain(
      "Prompt template nesting exceeds maximum depth"
    );
  }
});
