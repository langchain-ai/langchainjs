import { expect, test } from "vitest";

import { LengthBasedExampleSelector } from "@langchain/core/example_selectors";
import { PromptTemplate } from "@langchain/core/prompts";

test("Test using LengthBasedExampleSelector", async () => {
  const prompt = new PromptTemplate({
    template: "{foo} {bar}",
    inputVariables: ["foo"],
    partialVariables: { bar: "baz" },
  });
  const selector = await LengthBasedExampleSelector.fromExamples(
    [{ foo: "one one one" }],
    {
      examplePrompt: prompt,
      maxLength: 10,
    }
  );
  await selector.addExample({ foo: "one two three" });
  await selector.addExample({ foo: "four five six" });
  await selector.addExample({ foo: "seven eight nine" });
  await selector.addExample({ foo: "ten eleven twelve" });
  const chosen = await selector.selectExamples({ foo: "hello", bar: "world" });
  expect(chosen).toStrictEqual([
    { foo: "one one one" },
    { foo: "one two three" },
  ]);
});
