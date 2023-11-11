import { test, expect } from "@jest/globals";
import { OpenAI } from "../../llms/openai.js";
import { ConversationChain } from "../../chains/conversation.js";
import { ConversationTokenBufferMemory } from "../buffer_token_memory.js";
import { ChatMessageHistory } from "../../stores/message/in_memory.js";
import { HumanMessage, AIMessage } from "../../schema/index.js";


test("Test buffer token memory with LLM", async () => {

  const memory = new ConversationTokenBufferMemory({llm: new OpenAI(), maxTokenLimit: 10});
  
  const result1 = await memory.loadMemoryVariables({});
  expect(result1).toStrictEqual({ history: "" });

  await memory.saveContext({ input: "foo" }, { ouput: "bar" });
  const expectedString = "Human: foo\nAI: bar";
  const result2 = await memory.loadMemoryVariables({});
  console.log("result2", result2);

  expect(result2).toStrictEqual({ history: expectedString });

  await memory.saveContext({ foo: "foo" }, { bar: "bar" });
  await memory.saveContext({ foo: "bar" }, { bar: "foo" });
  const expectedString3 = "Human: bar\nAI: foo";
  const result3 = await memory.loadMemoryVariables({});
  expect(result3).toStrictEqual({ history: expectedString3 });
});

test("Test buffer token memory with pre-loaded history", async () => {
  const pastMessages = [
    new HumanMessage("My name's Jonas"),
    new AIMessage("Nice to meet you, Jonas!"),
  ];
  const memory = new ConversationTokenBufferMemory({
    llm: new OpenAI(),
    returnMessages: true,
    chatHistory: new ChatMessageHistory(pastMessages),
  });
  const result = await memory.loadMemoryVariables({});
  expect(result).toStrictEqual({ history: pastMessages });
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

  const chain = new ConversationChain({
    llm: model,
    memory: [memory],
    verbose: true,
  });

  const res1 = await chain.call({ input: "Hi, what's up?" });
  // console.log({ res1 });

  // const res1 = await chain.call({ input: "Hi, what's up?" });

  const result1 = await memory.loadMemoryVariables({});
  // console.log({res1});
  // const expectedString1 = "Human: Hi, what's up?\nAI:";
  // expect(res1).toStrictEqual({ history: expectedString1 });

//   // await conversationWithSummary.predict({ input: "Just working on writing some documentation!" });

//   // await conversationWithSummary.predict({ input: "For LangChain! Have you heard of it?" });

//   // await conversationWithSummary.predict({ 
//   //   input: "Haha nope, although a lot of people confuse it for that" 
//   // });
});
