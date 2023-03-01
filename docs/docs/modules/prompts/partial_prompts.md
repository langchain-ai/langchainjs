---
sidebar_position: 2
---

# Partial Prompt Templates

A prompt template is a class with a `.format` method which takes in a key-value map and returns a string (a prompt) to pass to the language model. Like other methods, it can make sense to "partial" a prompt template - eg pass in a subset of the required values, as to create a new prompt template which expects only the remaining subset of values.

LangChain supports this in two ways: we allow for partially formatted prompts (1) with string values, (2) with functions that return string values. These two different ways support different use cases. In the documentation below we go over the motivations for both use cases as well as how to do it in LangChain.

## Partial With Strings

One common use case for wanting to partial a prompt template is if you get some of the variables before others. For example, suppose you have a prompt template that requires two variables, `foo` and `baz`. If you get the `foo` value early on in the chain, but the `baz` value later, it can be annoying to wait until you have both variables in the same place to pass them to the prompt template. Instead, you can partial the prompt template with the `foo` value, and then pass the partialed prompt template along and just use that. Below is an example of doing this:

```typescript
import { expect, test } from "@jest/globals";
import { PromptTemplate } from "../prompt.js";
test("Test partial with function", async () => {
  const prompt = new PromptTemplate({
    template: "{foo}{bar}",
    inputVariables: ["foo", "bar"],
  });
  const partialPrompt = await prompt.partial({ foo: "foo" });
  expect(await partialPrompt.format({ bar: "baz" })).toBe("foobaz");
});
```

You can also just initialize the prompt with the partialed variables.

```typescript
import { expect, test } from "@jest/globals";
import { PromptTemplate } from "../prompt.js";
test("Test partial with function", async () => {
  const prompt = new PromptTemplate({
    template: "{foo}{bar}",
    inputVariables: ["foo"],
    partialVariables: { bar: "baz" },
  });
  expect(await prompt.format({ foo: "foo" })).toBe("foobaz");
});
```

## Partial With Functions

The other common use is to partial with a function. The use case for this is when you have a variable you know that you always want to fetch in a common way. A prime example of this is with date or time. Imagine you have a prompt which you always want to have the current date. You can't hard code it in the prompt, and passing it along with the other input variables is a bit annoying. In this case, it's very handy to be able to partial the prompt with a function that always returns the current date.

```typescript
import { expect, test } from "@jest/globals";
import { PromptTemplate } from "../prompt.js";
test("Test partial with function", async () => {
  const prompt = new PromptTemplate({
    template: "Tell me a {adjective} joke about the day {date}",
    inputVariables: ["adjective", "date"],
  });
  const partialPrompt = await prompt.partial({
    date: () => dateFunction,
  });
});
```

You can also just initialize the prompt with the partialed variables, which often makes more sense in this workflow.

```typescript
import { expect, test } from "@jest/globals";
import { PromptTemplate } from "../prompt.js";
test("Test partial with function", async () => {
  const prompt = new PromptTemplate({
    template: "Tell me a {adjective} joke about the day {date}",
    inputVariables: ["adjective"],
    partialVariables: { date: () => new Date().toLocaleDateString() },
  });
  expect(await prompt.format({ foo: "foo" })).toBe("foo<DATE>");
});
```
