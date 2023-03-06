import { expect, test } from "@jest/globals";
import {
  AIMessagePromptTemplate,
  ChatPromptTemplate,
  ChatMessagePromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "../chat.js";
import { PromptTemplate } from "../prompt.js";
import {
  AIChatMessage,
  ChatMessage,
  HumanChatMessage,
  SystemChatMessage,
} from "../../schema/index.js";

function createChatPromptTemplate(): ChatPromptTemplate {
  const systemPrompt = new PromptTemplate({
    template: "Here's some context: {context}",
    inputVariables: ["context"],
  });
  const userPrompt = new PromptTemplate({
    template: "Hello {foo}, I'm {bar}. Thanks for the {context}",
    inputVariables: ["foo", "bar", "context"],
  });
  const aiPrompt = new PromptTemplate({
    template: "I'm an AI. I'm {foo}. I'm {bar}.",
    inputVariables: ["foo", "bar"],
  });
  const genericPrompt = new PromptTemplate({
    template: "I'm a generic message. I'm {foo}. I'm {bar}.",
    inputVariables: ["foo", "bar"],
  });
  return new ChatPromptTemplate({
    promptMessages: [
      new SystemMessagePromptTemplate(systemPrompt),
      new HumanMessagePromptTemplate(userPrompt),
      new AIMessagePromptTemplate(aiPrompt),
      new ChatMessagePromptTemplate(genericPrompt, "test"),
    ],
    inputVariables: ["context", "foo", "bar"],
  });
}

test("Test format", async () => {
  const chatPrompt = createChatPromptTemplate();
  const messages = await chatPrompt.formatPromptValue({
    context: "This is a context",
    foo: "Foo",
    bar: "Bar",
  });
  expect(messages.toChatMessages()).toEqual([
    new SystemChatMessage("Here's some context: This is a context"),
    new HumanChatMessage(
      "Hello Foo, I'm Bar. Thanks for the This is a context"
    ),
    new AIChatMessage("I'm an AI. I'm Foo. I'm Bar."),
    new ChatMessage("I'm a generic message. I'm Foo. I'm Bar.", "test"),
  ]);
});

test("Test format with invalid input values", async () => {
  const chatPrompt = createChatPromptTemplate();
  await expect(
    chatPrompt.formatPromptValue({
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
          new SystemMessagePromptTemplate(systemPrompt),
          new HumanMessagePromptTemplate(userPrompt),
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
          new SystemMessagePromptTemplate(systemPrompt),
          new HumanMessagePromptTemplate(userPrompt),
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
    new SystemMessagePromptTemplate(systemPrompt),
    new HumanMessagePromptTemplate(userPrompt),
  ]);
  expect(chatPrompt.inputVariables).toEqual(["context", "foo", "bar"]);
  const messages = await chatPrompt.formatPromptValue({
    context: "This is a context",
    foo: "Foo",
    bar: "Bar",
  });
  expect(messages.toChatMessages()).toEqual([
    new SystemChatMessage("Here's some context: This is a context"),
    new HumanChatMessage("Hello Foo, I'm Bar"),
  ]);
});
