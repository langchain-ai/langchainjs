import { test } from "@jest/globals";
import {
  BaseChatMessage,
  SystemChatMessage,
  HumanChatMessage,
  AIChatMessage,
} from "../../schema/index.js";
import { ChatExample, ChatGoogleVertexAI } from "../googlevertexai.js";

test("Google messages", async () => {
  const messages: BaseChatMessage[] = [
    new SystemChatMessage("System1"),
    new HumanChatMessage("Human1"),
    new AIChatMessage("AI1"),
    new HumanChatMessage("Human2"),
  ];
  const model = new ChatGoogleVertexAI();
  const instance = model.generateInstance(messages, {});
  console.log(instance);
  expect(instance.context).toBe("System1");
  expect(instance.messages[0].author).toBe("user");
  expect(instance.messages[1].author).toBe("bot");
});

test("Google context constructor", async () => {
  const messages: BaseChatMessage[] = [
    new HumanChatMessage("Human1"),
    new AIChatMessage("AI1"),
    new HumanChatMessage("Human2"),
  ];
  const model = new ChatGoogleVertexAI({
    context: "Constructor context",
  });
  const instance = model.generateInstance(messages, {});
  console.log(instance);
  expect(instance.context).toBe("Constructor context");
  expect(instance.messages[0].author).toBe("user");
  expect(instance.messages[1].author).toBe("bot");
});

test("Google context options", async () => {
  const messages: BaseChatMessage[] = [
    new HumanChatMessage("Human1"),
    new AIChatMessage("AI1"),
    new HumanChatMessage("Human2"),
  ];
  const model = new ChatGoogleVertexAI();
  const instance = model.generateInstance(messages, {
    context: "Option context",
  });
  console.log(instance);
  expect(instance.context).toBe("Option context");
  expect(instance.messages[0].author).toBe("user");
  expect(instance.messages[1].author).toBe("bot");
});

test("Google context options override constructor", async () => {
  const messages: BaseChatMessage[] = [
    new HumanChatMessage("Human1"),
    new AIChatMessage("AI1"),
    new HumanChatMessage("Human2"),
  ];
  const model = new ChatGoogleVertexAI({
    context: "Constructor context",
  });
  const instance = model.generateInstance(messages, {
    context: "Option context",
  });
  console.log(instance);
  expect(instance.context).toBe("Option context");
  expect(instance.messages[0].author).toBe("user");
  expect(instance.messages[1].author).toBe("bot");
});

test("Google context system overrides all", async () => {
  const messages: BaseChatMessage[] = [
    new SystemChatMessage("System context"),
    new HumanChatMessage("Human1"),
    new AIChatMessage("AI1"),
    new HumanChatMessage("Human2"),
  ];
  const model = new ChatGoogleVertexAI({
    context: "Constructor context",
  });
  const instance = model.generateInstance(messages, {
    context: "Option context",
  });
  console.log(instance);
  expect(instance.context).toBe("System context");
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
  const instance = model.generateInstance(messages, {});
  console.log(JSON.stringify(instance, null, 1));
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  expect(instance.examples[0].input.author).toBe("user");
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  expect(instance.examples[0].output.author).toBe("bot");
});
