import { test, expect } from "@jest/globals";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { OpenAI } from "../../llms/openai.js";
import { LLMChain } from "../../chains/llm_chain.js";
import { ConversationTokenBufferMemory } from "../buffer_token_memory.js";
import { ChatMessageHistory } from "../../stores/message/in_memory.js";
import { HumanMessage, AIMessage } from "../../schema/index.js";
import { BufferWindowMemory } from "../buffer_window_memory.js";


test("Test buffer window memory with LLM", async () => {

  const memory = new ConversationTokenBufferMemory({llm: new OpenAI(), maxTokenLimit: 10});
  
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

