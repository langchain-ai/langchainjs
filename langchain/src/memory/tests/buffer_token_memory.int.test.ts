import { test, expect } from "@jest/globals";
import { OpenAI } from "../../llms/openai.js";
import { ConversationChain } from "../../chains/conversation.js";
import { ConversationTokenBufferMemory } from "../buffer_token_memory.js";

test("Test buffer window memory with LLM", async () => {
  const memory = new ConversationTokenBufferMemory({
    llm: new OpenAI(),
    maxTokenLimit: 10,
  });

  const result1 = await memory.loadMemoryVariables({});
  expect(result1).toStrictEqual({ history: "" });

  await memory.saveContext({ input: "hi" }, { ouput: "whats up" });
  await memory.saveContext({ input: "not much you" }, { ouput: "not much" });
  const expectedString = "Human: not much you\nAI: not much";
  const result2 = await memory.loadMemoryVariables({});
  expect(result2).toStrictEqual({ history: expectedString });

  await memory.saveContext({ foo: "bar1" }, { bar: "foo" });
  const expectedString3 = "Human: bar1\nAI: foo";
  const result3 = await memory.loadMemoryVariables({});
  expect(result3).toStrictEqual({ history: expectedString3 });
});

test("Test buffer memory with LLM chain", async () => {
  const model = new OpenAI({ modelName: "gpt-3.5-turbo", temperature: 0 });

  const memory = new ConversationTokenBufferMemory({
    llm: model,
    maxTokenLimit: 60,
  });
  expect(await memory.loadMemoryVariables({})).toEqual({
    history: "",
  });

  const conversationWithSummary = new ConversationChain({
    llm: model,
    memory,
    verbose: true,
  });

  // const res1 = await conversationWithSummary.call({ input: "Hi, what's up?" });
  // console.log({ res1 });

  await conversationWithSummary.predict({ input: "Hi, what's up?" });

  const result1 = await memory.loadMemoryVariables({});
  console.log({ result1 });
  const expectedString1 = "Human: Hi, what's up?\nAI:";
  expect(result1).toStrictEqual({ history: expectedString1 });

  // await conversationWithSummary.predict({ input: "Just working on writing some documentation!" });

  // await conversationWithSummary.predict({ input: "For LangChain! Have you heard of it?" });

  // await conversationWithSummary.predict({
  //   input: "Haha nope, although a lot of people confuse it for that"
  // });
});
