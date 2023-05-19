import { test } from "@jest/globals";
import { EntityMemory } from "../entity_memory.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { OpenAI } from "../../llms/openai.js";
import { LLMChain } from "../../chains/llm_chain.js";
import { ENTITY_MEMORY_CONVERSATION_TEMPLATE } from "../prompt.js";

test("Test entity memory in a chain", async () => {
  const memory = new EntityMemory({
    llm: new OpenAI({ temperature: 0 }),
  });
  const model = new OpenAI({ temperature: 0.9 });
  const chain = new LLMChain({
    llm: model,
    prompt: ENTITY_MEMORY_CONVERSATION_TEMPLATE,
    memory,
  });

  const res1 = await chain.call({ input: "Hi! I'm Jim." });
  console.log({
    res1,
    memory: await memory.loadMemoryVariables({ input: "Who is Jim?" }),
  });

  const res2 = await chain.call({
    input: "I work in sales. What about you?",
  });
  console.log({
    res2,
    memory: await memory.loadMemoryVariables({ input: "Who is Jim?" }),
  });

  const res3 = await chain.call({
    input:
      "My office is the Scranton branch of Dunder Mifflin. What about you?",
  });
  console.log({
    res3,
    memory: await memory.loadMemoryVariables({ input: "Who is Jim?" }),
  });

  const res4 = await chain.call({
    input: "I am Jim.",
  });
  console.log({
    res4,
    memory: await memory.loadMemoryVariables({ input: "Who is Jim?" }),
  });

  const res5 = await chain.call({
    input: "What have I told you about Jim so far?",
  });
  console.log({
    res5,
    memory: await memory.loadMemoryVariables({ input: "Who is Jim?" }),
  });
}, 100000);

test("Test entity memory with a chat model in a chain", async () => {
  const memory = new EntityMemory({
    llm: new ChatOpenAI({ temperature: 0 }),
  });
  const model = new ChatOpenAI({ temperature: 0.9 });
  const chain = new LLMChain({
    llm: model,
    prompt: ENTITY_MEMORY_CONVERSATION_TEMPLATE,
    memory,
  });

  const res1 = await chain.call({ input: "Hi! I'm Jim." });
  console.log({
    res1,
    memory: await memory.loadMemoryVariables({ input: "Who is Jim?" }),
  });

  const res2 = await chain.call({
    input: "I work in sales. What about you?",
  });
  console.log({
    res2,
    memory: await memory.loadMemoryVariables({ input: "Who is Jim?" }),
  });

  const res3 = await chain.call({
    input: "My office is the Utica branch of Dunder Mifflin. What about you?",
  });
  console.log({
    res3,
    memory: await memory.loadMemoryVariables({ input: "Who is Jim?" }),
  });

  const res4 = await chain.call({
    input: "I am Jim.",
  });
  console.log({
    res4,
    memory: await memory.loadMemoryVariables({ input: "Who is Jim?" }),
  });

  const res5 = await chain.call({
    input: "What have I told you about Jim so far?",
  });
  console.log({
    res5,
    memory: await memory.loadMemoryVariables({ input: "Who is Jim?" }),
  });
}, 100000);
