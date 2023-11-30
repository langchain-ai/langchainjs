import { expect, test } from "@jest/globals";
import {
  AIMessagePromptTemplate,
  ChatPromptTemplate,
  ChatMessagePromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
  MessagesPlaceholder,
} from "../chat.js";
import { PromptTemplate } from "../prompt.js";
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  ChatMessage,
  FunctionMessage,
} from "../../messages/index.js";

function createChatPromptTemplate() {
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
  // return new ChatPromptTemplate({
  //   promptMessages: [
  //     new SystemMessagePromptTemplate(systemPrompt),
  //     new HumanMessagePromptTemplate(userPrompt),
  //     new AIMessagePromptTemplate({ prompt: aiPrompt }),
  //     new ChatMessagePromptTemplate(genericPrompt, "test"),
  //   ],
  //   inputVariables: ["context", "foo", "bar"],
  // });
  return ChatPromptTemplate.fromMessages<{
    foo: string;
    bar: string;
    context: string;
  }>([
    new SystemMessagePromptTemplate(systemPrompt),
    new HumanMessagePromptTemplate(userPrompt),
    new AIMessagePromptTemplate({ prompt: aiPrompt }),
    new ChatMessagePromptTemplate(genericPrompt, "test"),
  ]);
}

test("Test format", async () => {
  const chatPrompt = createChatPromptTemplate();
  const messages = await chatPrompt.formatPromptValue({
    context: "This is a context",
    foo: "Foo",
    bar: "Bar",
    unused: "extra",
  });
  expect(messages.toChatMessages()).toEqual([
    new SystemMessage("Here's some context: This is a context"),
    new HumanMessage("Hello Foo, I'm Bar. Thanks for the This is a context"),
    new AIMessage("I'm an AI. I'm Foo. I'm Bar."),
    new ChatMessage("I'm a generic message. I'm Foo. I'm Bar.", "test"),
  ]);
});

test("Test format with invalid input values", async () => {
  const chatPrompt = createChatPromptTemplate();
  await expect(
    // @ts-expect-error TS compiler should flag missing input variables
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

test("Test fromTemplate", async () => {
  const chatPrompt = ChatPromptTemplate.fromTemplate("Hello {foo}, I'm {bar}");
  expect(chatPrompt.inputVariables).toEqual(["foo", "bar"]);
  const messages = await chatPrompt.formatPromptValue({
    foo: "Foo",
    bar: "Bar",
  });
  expect(messages.toChatMessages()).toEqual([
    new HumanMessage("Hello Foo, I'm Bar"),
  ]);
});

test("Test fromMessages", async () => {
  const systemPrompt = new PromptTemplate({
    template: "Here's some context: {context}",
    inputVariables: ["context"],
  });
  const userPrompt = new PromptTemplate({
    template: "Hello {foo}, I'm {bar}",
    inputVariables: ["foo", "bar"],
  });
  // TODO: Fix autocomplete for the fromMessages method
  const chatPrompt = ChatPromptTemplate.fromMessages([
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
    new SystemMessage("Here's some context: This is a context"),
    new HumanMessage("Hello Foo, I'm Bar"),
  ]);
});

test("Test fromMessages with a variety of ways to declare prompt messages", async () => {
  const systemPrompt = new PromptTemplate({
    template: "Here's some context: {context}",
    inputVariables: ["context"],
  });
  // TODO: Fix autocomplete for the fromMessages method
  const chatPrompt = ChatPromptTemplate.fromMessages([
    new SystemMessagePromptTemplate(systemPrompt),
    "Hello {foo}, I'm {bar}",
    ["assistant", "Nice to meet you, {bar}!"],
    ["human", "Thanks {foo}!!"],
  ]);
  const messages = await chatPrompt.formatPromptValue({
    context: "This is a context",
    foo: "Foo",
    bar: "Bar",
  });
  expect(messages.toChatMessages()).toEqual([
    new SystemMessage("Here's some context: This is a context"),
    new HumanMessage("Hello Foo, I'm Bar"),
    new AIMessage("Nice to meet you, Bar!"),
    new HumanMessage("Thanks Foo!!"),
  ]);
});

test("Test fromMessages with an extra input variable", async () => {
  const systemPrompt = new PromptTemplate({
    template: "Here's some context: {context}",
    inputVariables: ["context"],
  });
  const userPrompt = new PromptTemplate({
    template: "Hello {foo}, I'm {bar}",
    inputVariables: ["foo", "bar"],
  });
  // TODO: Fix autocomplete for the fromMessages method
  const chatPrompt = ChatPromptTemplate.fromMessages([
    new SystemMessagePromptTemplate(systemPrompt),
    new HumanMessagePromptTemplate(userPrompt),
  ]);
  expect(chatPrompt.inputVariables).toEqual(["context", "foo", "bar"]);
  const messages = await chatPrompt.formatPromptValue({
    context: "This is a context",
    foo: "Foo",
    bar: "Bar",
    unused: "No problemo!",
  });
  expect(messages.toChatMessages()).toEqual([
    new SystemMessage("Here's some context: This is a context"),
    new HumanMessage("Hello Foo, I'm Bar"),
  ]);
});

test("Test fromMessages is composable", async () => {
  const systemPrompt = new PromptTemplate({
    template: "Here's some context: {context}",
    inputVariables: ["context"],
  });
  const userPrompt = new PromptTemplate({
    template: "Hello {foo}, I'm {bar}",
    inputVariables: ["foo", "bar"],
  });
  const chatPromptInner = ChatPromptTemplate.fromMessages([
    new SystemMessagePromptTemplate(systemPrompt),
    new HumanMessagePromptTemplate(userPrompt),
  ]);
  const chatPrompt = ChatPromptTemplate.fromMessages([
    chatPromptInner,
    AIMessagePromptTemplate.fromTemplate("I'm an AI. I'm {foo}. I'm {bar}."),
  ]);
  expect(chatPrompt.inputVariables).toEqual(["context", "foo", "bar"]);
  const messages = await chatPrompt.formatPromptValue({
    context: "This is a context",
    foo: "Foo",
    bar: "Bar",
  });
  expect(messages.toChatMessages()).toEqual([
    new SystemMessage("Here's some context: This is a context"),
    new HumanMessage("Hello Foo, I'm Bar"),
    new AIMessage("I'm an AI. I'm Foo. I'm Bar."),
  ]);
});

test("Test fromMessages is composable with partial vars", async () => {
  const systemPrompt = new PromptTemplate({
    template: "Here's some context: {context}",
    inputVariables: ["context"],
  });
  const userPrompt = new PromptTemplate({
    template: "Hello {foo}, I'm {bar}",
    inputVariables: ["foo", "bar"],
  });
  const chatPromptInner = ChatPromptTemplate.fromMessages([
    new SystemMessagePromptTemplate(systemPrompt),
    new HumanMessagePromptTemplate(userPrompt),
  ]);
  const chatPrompt = ChatPromptTemplate.fromMessages([
    await chatPromptInner.partial({
      context: "This is a context",
      foo: "Foo",
    }),
    AIMessagePromptTemplate.fromTemplate("I'm an AI. I'm {foo}. I'm {bar}."),
  ]);
  expect(chatPrompt.inputVariables).toEqual(["bar"]);
  const messages = await chatPrompt.formatPromptValue({
    bar: "Bar",
  });
  expect(messages.toChatMessages()).toEqual([
    new SystemMessage("Here's some context: This is a context"),
    new HumanMessage("Hello Foo, I'm Bar"),
    new AIMessage("I'm an AI. I'm Foo. I'm Bar."),
  ]);
});

test("Test SimpleMessagePromptTemplate", async () => {
  const prompt = new MessagesPlaceholder("foo");
  const values = { foo: [new HumanMessage("Hello Foo, I'm Bar")] };
  const messages = await prompt.formatMessages(values);
  expect(messages).toEqual([new HumanMessage("Hello Foo, I'm Bar")]);
});

test("Test using partial", async () => {
  const userPrompt = new PromptTemplate({
    template: "{foo}{bar}",
    inputVariables: ["foo", "bar"],
  });

  const prompt = new ChatPromptTemplate({
    promptMessages: [new HumanMessagePromptTemplate(userPrompt)],
    inputVariables: ["foo", "bar"],
  });

  const partialPrompt = await prompt.partial({ foo: "foo" });

  // original prompt is not modified
  expect(prompt.inputVariables).toEqual(["foo", "bar"]);
  // partial prompt has only remaining variables
  expect(partialPrompt.inputVariables).toEqual(["bar"]);

  expect(await partialPrompt.format({ bar: "baz" })).toMatchInlineSnapshot(
    `"Human: foobaz"`
  );
});

test("Test BaseMessage", async () => {
  const prompt = ChatPromptTemplate.fromMessages([
    new SystemMessage("You are a chatbot {mock_variable}"),
    AIMessagePromptTemplate.fromTemplate("{name} is my name."),
    new FunctionMessage({ content: "{}", name: "get_weather" }),
  ]);

  const messages = await prompt.formatPromptValue({ name: "Bob" });

  expect(prompt.inputVariables).toEqual(["name"]);
  expect(prompt.partialVariables).toEqual({});

  expect(messages.toChatMessages()).toEqual([
    new SystemMessage("You are a chatbot {mock_variable}"),
    new AIMessage("Bob is my name."),
    new FunctionMessage({ content: "{}", name: "get_weather" }),
  ]);
});

test("Throws if trying to pass non BaseMessage inputs to MessagesPlaceholder", async () => {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "some string"],
    new MessagesPlaceholder("chatHistory"),
    ["human", "{question}"],
  ]);
  const value = "this is not a valid input type!";

  try {
    await prompt.formatMessages({
      chatHistory: value,
      question: "What is the meaning of life?",
    });
  } catch (e) {
    // eslint-disable-next-line no-instanceof/no-instanceof
    if (e instanceof Error) {
      expect(e.name).toBe("InputFormatError");
    } else {
      throw e;
    }
  }
});

test("Does not throws if null or undefined is passed as input to MessagesPlaceholder", async () => {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "some string"],
    new MessagesPlaceholder("chatHistory"),
    new MessagesPlaceholder("chatHistory2"),
    ["human", "{question}"],
  ]);
  const value1 = null;
  const value2 = undefined;

  try {
    await prompt.formatMessages({
      chatHistory: value1,
      chatHistory2: value2,
      question: "What is the meaning of life?",
    });
  } catch (e) {
    // eslint-disable-next-line no-instanceof/no-instanceof
    if (e instanceof Error) {
      expect(e.name).toBe("InputFormatError");
    } else {
      throw e;
    }
  }
});
