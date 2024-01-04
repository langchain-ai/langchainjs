import { PromptTemplate } from "@langchain/core/prompts";

export const run = async () => {
  // The `partial` method returns a new `PromptTemplate` object that can be used to format the prompt with only some of the input variables.
  const promptA = new PromptTemplate({
    template: "{foo}{bar}",
    inputVariables: ["foo", "bar"],
  });
  const partialPromptA = await promptA.partial({ foo: "foo" });
  console.log(await partialPromptA.format({ bar: "bar" }));
  // foobar

  // You can also explicitly specify the partial variables when creating the `PromptTemplate` object.
  const promptB = new PromptTemplate({
    template: "{foo}{bar}",
    inputVariables: ["foo"],
    partialVariables: { bar: "bar" },
  });
  console.log(await promptB.format({ foo: "foo" }));
  // foobar

  // You can also use partial formatting with function inputs instead of string inputs.
  const promptC = new PromptTemplate({
    template: "Tell me a {adjective} joke about the day {date}",
    inputVariables: ["adjective", "date"],
  });
  const partialPromptC = await promptC.partial({
    date: () => new Date().toLocaleDateString(),
  });
  console.log(await partialPromptC.format({ adjective: "funny" }));
  // Tell me a funny joke about the day 3/22/2023

  const promptD = new PromptTemplate({
    template: "Tell me a {adjective} joke about the day {date}",
    inputVariables: ["adjective"],
    partialVariables: { date: () => new Date().toLocaleDateString() },
  });
  console.log(await promptD.format({ adjective: "funny" }));
  // Tell me a funny joke about the day 3/22/2023
};
