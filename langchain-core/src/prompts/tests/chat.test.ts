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
import { Document } from "../../documents/document.js";

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

test("Test fromTemplate", async () => {
  const chatPrompt = ChatPromptTemplate.fromTemplate("Hello {foo}, I'm {bar}");
  expect(chatPrompt.inputVariables).toEqual(["foo", "bar"]);
  expect(
    (
      await chatPrompt.invoke({
        foo: ["barbar"],
        bar: [new Document({ pageContent: "bar" })],
      })
    ).toChatMessages()
  ).toEqual([
    new HumanMessage(
      `Hello ["barbar"], I'm [{"pageContent":"bar","metadata":{}}]`
    ),
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

test("Test fromMessages with non-string inputs", async () => {
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
    context: [new Document({ pageContent: "bar" })],
    foo: "Foo",
    bar: "Bar",
  });
  expect(messages.toChatMessages()).toEqual([
    new SystemMessage(
      `Here's some context: [{"pageContent":"bar","metadata":{}}]`
    ),
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

test("Test MessagesPlaceholder optional", async () => {
  const prompt = new MessagesPlaceholder({
    variableName: "foo",
    optional: true,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages = await prompt.formatMessages({} as any);
  expect(messages).toEqual([]);
});

test("Test MessagesPlaceholder optional in a chat prompt template", async () => {
  const prompt = ChatPromptTemplate.fromMessages([
    new MessagesPlaceholder({
      variableName: "foo",
      optional: true,
    }),
  ]);
  const messages = await prompt.formatMessages({});
  expect(messages).toEqual([]);
});

test("Test MessagesPlaceholder not optional", async () => {
  const prompt = new MessagesPlaceholder({
    variableName: "foo",
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await expect(prompt.formatMessages({} as any)).rejects.toThrow(
    'Field "foo" in prompt uses a MessagesPlaceholder, which expects an array of BaseMessages as an input value. Received: undefined'
  );
});

test("Test MessagesPlaceholder not optional with invalid input should throw", async () => {
  const prompt = new MessagesPlaceholder({
    variableName: "foo",
  });
  const badInput = [new Document({ pageContent: "barbar", metadata: {} })];
  await expect(
    prompt.formatMessages({
      foo: [new Document({ pageContent: "barbar", metadata: {} })],
    })
  ).rejects.toThrow(
    `Field "foo" in prompt uses a MessagesPlaceholder, which expects an array of BaseMessages or coerceable values as input.\n\nReceived value: ${JSON.stringify(
      badInput,
      null,
      2
    )}\n\nAdditional message: Unable to coerce message from array: only human, AI, or system message coercion is currently supported.`
  );
});

test("Test MessagesPlaceholder shorthand in a chat prompt template should throw for invalid syntax", async () => {
  expect(() =>
    ChatPromptTemplate.fromMessages([["placeholder", "foo"]])
  ).toThrow();
});

test("Test MessagesPlaceholder shorthand in a chat prompt template", async () => {
  const prompt = ChatPromptTemplate.fromMessages([["placeholder", "{foo}"]]);
  const messages = await prompt.formatMessages({
    foo: [new HumanMessage("Hi there!"), new AIMessage("how r u")],
  });
  expect(messages).toEqual([
    new HumanMessage("Hi there!"),
    new AIMessage("how r u"),
  ]);
});

test("Test MessagesPlaceholder shorthand in a chat prompt template with object format", async () => {
  const prompt = ChatPromptTemplate.fromMessages([["placeholder", "{foo}"]]);
  const messages = await prompt.formatMessages({
    foo: [
      {
        type: "system",
        content: "some initial content",
      },
      {
        type: "human",
        content: [
          {
            text: "page: 1\ndescription: One Purchase Flow\ntimestamp: '2024-06-04T14:46:46.062Z'\ntype: navigate\nscreenshot_present: true\n",
            type: "text",
          },
          {
            text: "page: 3\ndescription: intent_str=buy,mode_str=redirect,screenName_str=order-completed,\ntimestamp: '2024-06-04T14:46:58.846Z'\ntype: Screen View\nscreenshot_present: false\n",
            type: "text",
          },
        ],
      },
      {
        type: "assistant",
        content: "some captivating response",
      },
    ],
  });
  expect(messages).toEqual([
    new SystemMessage("some initial content"),
    new HumanMessage({
      content: [
        {
          text: "page: 1\ndescription: One Purchase Flow\ntimestamp: '2024-06-04T14:46:46.062Z'\ntype: navigate\nscreenshot_present: true\n",
          type: "text",
        },
        {
          text: "page: 3\ndescription: intent_str=buy,mode_str=redirect,screenName_str=order-completed,\ntimestamp: '2024-06-04T14:46:58.846Z'\ntype: Screen View\nscreenshot_present: false\n",
          type: "text",
        },
      ],
    }),
    new AIMessage("some captivating response"),
  ]);
});

test("Test MessagesPlaceholder with invalid shorthand should throw", async () => {
  const prompt = ChatPromptTemplate.fromMessages([["placeholder", "{foo}"]]);
  await expect(() =>
    prompt.formatMessages({
      foo: [{ badFormatting: true }],
    })
  ).rejects.toThrow();
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

test("Multi part chat prompt template", async () => {
  const name = "Bob";
  const objectName = "chair";
  const template = ChatPromptTemplate.fromMessages([
    ["system", "You are an AI assistant named {name}"],
    [
      "human",
      [
        {
          type: "text",
          text: "What is in this object {objectName}",
        },
      ],
    ],
  ]);
  const messages = await template.formatMessages({
    name,
    objectName,
  });
  expect(messages).toEqual([
    new SystemMessage("You are an AI assistant named Bob"),
    new HumanMessage({
      content: [
        {
          type: "text",
          text: "What is in this object chair",
        },
      ],
    }),
  ]);
});

test("Multi part chat prompt template with image", async () => {
  const name = "Bob";
  const objectName = "chair";
  const myImage = "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAA";
  const myUrl = "https://www.example.com/image.png";
  const template = ChatPromptTemplate.fromMessages([
    ["system", "You are an AI assistant named {name}"],
    [
      "human",
      [
        {
          type: "image_url",
          image_url: "data:image/jpeg;base64,{myImage}",
        },
        {
          type: "text",
          text: "What is in this object {objectName}",
        },
        {
          type: "image_url",
          image_url: {
            url: "{myUrl}",
            detail: "high",
          },
        },
      ],
    ],
  ]);
  const messages = await template.formatMessages({
    name,
    objectName,
    myImage,
    myUrl,
  });
  expect(messages).toEqual([
    new SystemMessage("You are an AI assistant named Bob"),
    new HumanMessage({
      content: [
        {
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${myImage}`,
          },
        },
        {
          type: "text",
          text: `What is in this object ${objectName}`,
        },
        {
          type: "image_url",
          image_url: {
            url: `${myUrl}`,
            detail: "high",
          },
        },
      ],
    }),
  ]);
});

test("Multi-modal, multi part chat prompt works with instances of BaseMessage", async () => {
  const name = "Bob";
  const objectName = "chair";
  const myImage = "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAA";
  const myUrl = "https://www.example.com/image.png";
  const inlineImageUrl = new HumanMessage({
    content: [
      {
        type: "image_url",
        image_url: "data:image/jpeg;base64,{myImage}",
      },
    ],
  });
  const objectImageUrl = new HumanMessage({
    content: [
      {
        type: "image_url",
        image_url: {
          url: "data:image/jpeg;base64,{myImage}",
          detail: "high",
        },
      },
    ],
  });
  const normalMessage = new HumanMessage({
    content: [
      {
        type: "text",
        text: "What is in this object {objectName}",
      },
    ],
  });
  const template = ChatPromptTemplate.fromMessages([
    ["system", "You are an AI assistant named {name}"],
    inlineImageUrl,
    normalMessage,
    objectImageUrl,
    [
      "human",
      [
        {
          type: "text",
          text: "What is in this object {objectName}",
        },
        {
          type: "image_url",
          image_url: {
            url: "{myUrl}",
            detail: "high",
          },
        },
      ],
    ],
  ]);
  const messages = await template.formatMessages({
    name,
    objectName,
    myImage,
    myUrl,
  });
  expect(messages).toMatchSnapshot();
});

test("Format complex messages and keep additional fields", async () => {
  const examplePrompt = ChatPromptTemplate.fromMessages([
    [
      "human",
      [
        {
          type: "text",
          text: "{input}",
          cache_control: { type: "ephemeral" },
        },
      ],
    ],
    [
      "ai",
      [
        {
          type: "text",
          text: "{output}",
          cache_control: { type: "ephemeral" },
        },
      ],
    ],
  ]);
  const formatted = await examplePrompt.formatMessages({
    input: "hello",
    output: "ciao",
  });

  expect(formatted).toHaveLength(2);

  expect(formatted[0]._getType()).toBe("human");
  expect(formatted[0].content[0]).toHaveProperty("cache_control");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((formatted[0].content[0] as any).cache_control).toEqual({
    type: "ephemeral",
  });

  expect(formatted[1]._getType()).toBe("ai");
  expect(formatted[1].content[0]).toHaveProperty("cache_control");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((formatted[1].content[0] as any).cache_control).toEqual({
    type: "ephemeral",
  });
});

test("Format image content messages and keep additional fields", async () => {
  const examplePrompt = ChatPromptTemplate.fromMessages([
    [
      "human",
      [
        {
          type: "image_url",
          image_url: "{image_url}",
          cache_control: { type: "ephemeral" },
        },
      ],
    ],
  ]);
  const formatted = await examplePrompt.formatMessages({
    image_url: "image_url",
  });

  expect(formatted).toHaveLength(1);

  expect(formatted[0]._getType()).toBe("human");
  expect(formatted[0].content[0]).toHaveProperty("cache_control");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((formatted[0].content[0] as any).cache_control).toEqual({
    type: "ephemeral",
  });
});
