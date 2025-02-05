import { test, expect } from "@jest/globals";
import { AIMessage } from "../../messages/ai.js";
import { HumanMessage } from "../../messages/human.js";
import { SystemMessage } from "../../messages/system.js";
import { ChatPromptTemplate, HumanMessagePromptTemplate } from "../chat.js";

test("Test creating a chat prompt template from role string messages", async () => {
  const template = ChatPromptTemplate.fromMessages(
    [
      ["system", "You are a helpful AI bot. Your name is {{name}}."],
      ["human", "Hello, how are you doing?"],
      ["ai", "I'm doing well, thanks!"],
      ["human", "{{userInput}}"],
    ],
    {
      templateFormat: "mustache",
    }
  );

  const messages = await template.formatMessages({
    name: "Bob",
    userInput: "What is your name?",
  });

  expect(messages).toEqual([
    new SystemMessage({
      content: "You are a helpful AI bot. Your name is Bob.",
    }),
    new HumanMessage({
      content: "Hello, how are you doing?",
    }),
    new AIMessage({
      content: "I'm doing well, thanks!",
    }),
    new HumanMessage({
      content: "What is your name?",
    }),
  ]);
});

test("Multiple input variables with repeats.", async () => {
  const template = "This {{bar}} is a {{foo}} test {{foo}}.";
  const prompt = ChatPromptTemplate.fromTemplate(template, {
    templateFormat: "mustache",
  });
  expect(prompt.inputVariables).toEqual(["bar", "foo"]);
  const formattedPrompt = await prompt.formatPromptValue({
    bar: "baz",
    foo: "bar",
  });
  expect(formattedPrompt.toChatMessages()).toEqual([
    new HumanMessage("This baz is a bar test bar."),
  ]);
});

test("Ignores f-string inputs input variables with repeats.", async () => {
  const template = "This {bar} is a {foo} test {foo}.";
  const prompt = ChatPromptTemplate.fromTemplate(template, {
    templateFormat: "mustache",
  });
  expect(prompt.inputVariables).toEqual([]);
  const formattedPrompt = await prompt.formatPromptValue({
    bar: "baz",
    foo: "bar",
  });
  expect(formattedPrompt.toChatMessages()).toEqual([
    new HumanMessage("This {bar} is a {foo} test {foo}."),
  ]);
});

test("Mustache template with image and chat prompts inside one template (fromMessages)", async () => {
  const template = ChatPromptTemplate.fromMessages(
    [
      [
        "human",
        [
          {
            type: "image_url",
            image_url: "{{image_url}}",
          },
          {
            type: "text",
            text: "{{other_var}}",
          },
        ],
      ],
      ["human", "hello {{name}}"],
    ],
    {
      templateFormat: "mustache",
    }
  );

  const messages = await template.formatMessages({
    name: "Bob",
    image_url: "https://foo.com/bar.png",
    other_var: "bar",
  });

  expect(messages).toEqual([
    new HumanMessage({
      content: [
        { type: "image_url", image_url: { url: "https://foo.com/bar.png" } },
        { type: "text", text: "bar" },
      ],
    }),
    new HumanMessage({
      content: "hello Bob",
    }),
  ]);

  expect(template.inputVariables.sort()).toEqual([
    "image_url",
    "name",
    "other_var",
  ]);
});

test("Mustache image template with nested URL and chat prompts HumanMessagePromptTemplate.fromTemplate", async () => {
  const template = HumanMessagePromptTemplate.fromTemplate(
    [
      {
        text: "{{name}}",
      },
      {
        image_url: {
          url: "{{image_url}}",
        },
      },
    ],
    {
      templateFormat: "mustache",
    }
  );

  const messages = await template.formatMessages({
    name: "Bob",
    image_url: "https://foo.com/bar.png",
  });

  expect(messages).toEqual([
    new HumanMessage({
      content: [
        { type: "text", text: "Bob" },
        { type: "image_url", image_url: { url: "https://foo.com/bar.png" } },
      ],
    }),
  ]);

  expect(template.inputVariables.sort()).toEqual(["image_url", "name"]);
});

test("Mustache image template with nested props", async () => {
  const template = ChatPromptTemplate.fromMessages(
    [
      ["human", "{{agent.name}}"],
      ["placeholder", "{{messages}}"],
    ],
    {
      templateFormat: "mustache",
    }
  );

  const messages = await template.formatMessages({
    agent: { name: "testing" },
    messages: [
      {
        role: "assistant",
        content: "hi there!",
      },
    ],
  });

  expect(messages).toEqual([
    new HumanMessage({
      content: "testing",
    }),
    new AIMessage("hi there!"),
  ]);

  expect(template.inputVariables.sort()).toEqual(["agent", "messages"]);
});
