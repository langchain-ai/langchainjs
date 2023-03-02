import { expect, test } from "@jest/globals";
import { ChatPromptTemplate } from "../chat.js";
import { PromptTemplate } from "../prompt.js";

test("Test format", async () => {
  const systemPrompt = new PromptTemplate({
    template: "Here's some context: {context}",
    inputVariables: ["context"],
  });
  const userPrompt = new PromptTemplate({
    template: "Hello {foo}, I'm {bar}",
    inputVariables: ["foo", "bar"],
  });
  const chatPrompt = new ChatPromptTemplate({
    promptMessages: [
      {
        role: "system",
        message: systemPrompt,
      },
      {
        role: "user",
        message: userPrompt,
      },
    ],
    inputVariables: ["context", "foo", "bar"],
  });
  const messages = await chatPrompt.formatChat({
    context: "This is a context",
    foo: "Foo",
    bar: "Bar",
  });
  expect(messages).toEqual([
    {
      role: "system",
      text: "Here's some context: This is a context",
    },
    {
      role: "user",
      text: "Hello Foo, I'm Bar",
    },
  ]);
});

test("Test format with invalid input values", async () => {
  const systemPrompt = new PromptTemplate({
    template: "Here's some context: {context}",
    inputVariables: ["context"],
  });
  const userPrompt = new PromptTemplate({
    template: "Hello {foo}, I'm {bar}",
    inputVariables: ["foo", "bar"],
  });
  const chatPrompt = new ChatPromptTemplate({
    promptMessages: [
      {
        role: "system",
        message: systemPrompt,
      },
      {
        role: "user",
        message: userPrompt,
      },
    ],
    inputVariables: ["context", "foo", "bar"],
  });
  await expect(
    chatPrompt.formatChat({
      context: "This is a context",
      foo: "Foo",
    })
  ).rejects.toThrow("Missing value for input variable `bar`");
});

test("Test format with invalid input variables", async () => {
  const systemPrompt = new PromptTemplate({
    template: "Here's some context: {context}",
    inputVariables: ["context"],
  });
  const userPrompt = new PromptTemplate({
    template: "Hello {foo}, I'm {bar}",
    inputVariables: ["foo", "bar"],
  });
  expect(
    () =>
      new ChatPromptTemplate({
        promptMessages: [
          {
            role: "system",
            message: systemPrompt,
          },
          {
            role: "user",
            message: userPrompt,
          },
        ],
        inputVariables: ["context", "foo", "bar", "baz"],
      })
  ).toThrow(
    "Input variables `baz` are not used in any of the prompt messages."
  );

  expect(
    () =>
      new ChatPromptTemplate({
        promptMessages: [
          {
            role: "system",
            message: systemPrompt,
          },
          {
            role: "user",
            message: userPrompt,
          },
        ],
        inputVariables: ["context", "foo"],
      })
  ).toThrow(
    "Input variables `bar` are used in prompt messages but not in the prompt template."
  );
});

test("Test fromPromptMessages", async () => {
  const systemPrompt = new PromptTemplate({
    template: "Here's some context: {context}",
    inputVariables: ["context"],
  });
  const userPrompt = new PromptTemplate({
    template: "Hello {foo}, I'm {bar}",
    inputVariables: ["foo", "bar"],
  });
  const chatPrompt = ChatPromptTemplate.fromPromptMessages([
    {
      role: "system",
      message: systemPrompt,
    },
    {
      role: "user",
      message: userPrompt,
    },
  ]);
  expect(chatPrompt.inputVariables).toEqual(["context", "foo", "bar"]);
  const messages = await chatPrompt.formatChat({
    context: "This is a context",
    foo: "Foo",
    bar: "Bar",
  });
  expect(messages).toEqual([
    {
      role: "system",
      text: "Here's some context: This is a context",
    },
    {
      role: "user",
      text: "Hello Foo, I'm Bar",
    },
  ]);
});
