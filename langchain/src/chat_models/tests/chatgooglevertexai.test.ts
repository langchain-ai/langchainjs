import { test, expect } from "@jest/globals";
import {
  BaseChatMessage,
  SystemChatMessage,
  HumanChatMessage,
  AIChatMessage,
} from "../../schema/index.js";
import { ChatExample, ChatGoogleVertexAI } from "../googlevertexai.js";

test("Google messages", async () => {
  const messages: BaseChatMessage[] = [
    new HumanChatMessage("Human1"),
    new AIChatMessage("AI1"),
    new HumanChatMessage("Human2"),
  ];
  const model = new ChatGoogleVertexAI();
  const instance = model.createInstance(messages);
  expect(instance.context).toBe("");
  expect(instance.messages[0].author).toBe("user");
  expect(instance.messages[1].author).toBe("bot");
});

test("Google messages with a system message", async () => {
  const messages: BaseChatMessage[] = [
    new SystemChatMessage("System1"),
    new HumanChatMessage("Human1"),
    new AIChatMessage("AI1"),
    new HumanChatMessage("Human2"),
  ];
  const model = new ChatGoogleVertexAI();
  const instance = model.createInstance(messages);
  expect(instance.context).toBe("System1");
  expect(instance.messages[0].author).toBe("user");
  expect(instance.messages[1].author).toBe("bot");
});

test("Google examples", async () => {
  const messages: BaseChatMessage[] = [
    new SystemChatMessage("System1"),
    new HumanChatMessage("Human1"),
    new AIChatMessage("AI1"),
    new HumanChatMessage("Human2"),
  ];
  const examples: ChatExample[] = [
    {
      input: new HumanChatMessage("Example Human1"),
      output: new AIChatMessage("Example AI1"),
    },
  ];
  const model = new ChatGoogleVertexAI({
    examples,
  });
  const instance = model.createInstance(messages);
  console.log(JSON.stringify(instance, null, 2));
  expect(instance.examples?.[0].input.author).toBe("user");
  expect(instance.examples?.[0].output.author).toBe("bot");
});

test("Google Throw an error for input messages where SystemMessage is not first", async () => {
  const messages: BaseChatMessage[] = [
    new HumanChatMessage("Human1"),
    new SystemChatMessage("System1"),
    new AIChatMessage("AI1"),
    new HumanChatMessage("Human2"),
  ];
  const model = new ChatGoogleVertexAI();
  expect(() => model.createInstance(messages)).toThrow();
});

test("Google Throw an error for input messages where messages the same type of message occurs twice in a row", async () => {
  const messages: BaseChatMessage[] = [
    new SystemChatMessage("System1"),
    new HumanChatMessage("Human1"),
    new HumanChatMessage("Human2"),
    new AIChatMessage("AI1"),
  ];
  const model = new ChatGoogleVertexAI();
  expect(() => model.createInstance(messages)).toThrow();
});

test("Google Throw an error for an even number of non-system input messages", async () => {
  const messages: BaseChatMessage[] = [
    new SystemChatMessage("System1"),
    new HumanChatMessage("Human2"),
    new AIChatMessage("AI1"),
  ];
  const model = new ChatGoogleVertexAI();
  expect(() => model.createInstance(messages)).toThrow();
});
