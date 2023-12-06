import { test, expect } from "@jest/globals";
import {
  BaseMessage,
  SystemMessage,
  HumanMessage,
  AIMessage,
} from "../../schema/index.js";
import { ChatExample, ChatGoogleVertexAI } from "../googlevertexai/index.js";

test("Google messages", async () => {
  const messages: BaseMessage[] = [
    new HumanMessage("Human1"),
    new AIMessage("AI1"),
    new HumanMessage("Human2"),
  ];
  const model = new ChatGoogleVertexAI();
  const instance = model.createInstance(messages);
  expect(instance.context).toBe("");
  expect(instance.messages[0].author).toBe("user");
  expect(instance.messages[1].author).toBe("bot");
});

test("Google messages with a system message", async () => {
  const messages: BaseMessage[] = [
    new SystemMessage("System1"),
    new HumanMessage("Human1"),
    new AIMessage("AI1"),
    new HumanMessage("Human2"),
  ];
  const model = new ChatGoogleVertexAI();
  const instance = model.createInstance(messages);
  expect(instance.context).toBe("System1");
  expect(instance.messages[0].author).toBe("user");
  expect(instance.messages[1].author).toBe("bot");
});

test("Google examples", async () => {
  const messages: BaseMessage[] = [
    new SystemMessage("System1"),
    new HumanMessage("Human1"),
    new AIMessage("AI1"),
    new HumanMessage("Human2"),
  ];
  const examples: ChatExample[] = [
    {
      input: new HumanMessage("Example Human1"),
      output: new AIMessage("Example AI1"),
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
  const messages: BaseMessage[] = [
    new HumanMessage("Human1"),
    new SystemMessage("System1"),
    new AIMessage("AI1"),
    new HumanMessage("Human2"),
  ];
  const model = new ChatGoogleVertexAI();
  expect(() => model.createInstance(messages)).toThrow();
});

test("Google Throw an error for input messages where messages the same type of message occurs twice in a row", async () => {
  const messages: BaseMessage[] = [
    new SystemMessage("System1"),
    new HumanMessage("Human1"),
    new HumanMessage("Human2"),
    new AIMessage("AI1"),
  ];
  const model = new ChatGoogleVertexAI();
  expect(() => model.createInstance(messages)).toThrow();
});

test("Google Throw an error for an even number of non-system input messages", async () => {
  const messages: BaseMessage[] = [
    new SystemMessage("System1"),
    new HumanMessage("Human2"),
    new AIMessage("AI1"),
  ];
  const model = new ChatGoogleVertexAI();
  expect(() => model.createInstance(messages)).toThrow();
});

test("Google code messages", async () => {
  const messages: BaseMessage[] = [
    new HumanMessage("Human1"),
    new AIMessage("AI1"),
    new HumanMessage("Human2"),
  ];
  const model = new ChatGoogleVertexAI({ model: "codechat-bison" });
  const instance = model.createInstance(messages);
  expect(instance.context).toBe("");
  expect(instance.messages[0].author).toBe("user");
  expect(instance.messages[1].author).toBe("system");
});

test("Google code messages with a system message", async () => {
  const messages: BaseMessage[] = [
    new SystemMessage("System1"),
    new HumanMessage("Human1"),
    new AIMessage("AI1"),
    new HumanMessage("Human2"),
  ];
  const model = new ChatGoogleVertexAI({ model: "codechat-bison" });
  const instance = model.createInstance(messages);
  expect(instance.context).toBe("System1");
  expect(instance.messages[0].author).toBe("user");
  expect(instance.messages[1].author).toBe("system");
});
