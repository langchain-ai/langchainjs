import { test } from "@jest/globals";
import { ChatOpenAI, OpenAI } from "@langchain/openai";
import { EntityMemory } from "../entity_memory.js";
import { LLMChain } from "../../chains/llm_chain.js";
import { ENTITY_MEMORY_CONVERSATION_TEMPLATE } from "../prompt.js";

test.skip("Test entity memory in a chain", async () => {
  const memory = new EntityMemory({
    llm: new OpenAI({ temperature: 0 }),
  });
  const model = new OpenAI({ temperature: 0.9 });
  const chain = new LLMChain({
    llm: model,
    prompt: ENTITY_MEMORY_CONVERSATION_TEMPLATE,
    memory,
  });

  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res1 = await chain.call({ input: "Hi! I'm Jim." });
  // console.log({
  //   res1,
  //   memory: await memory.loadMemoryVariables({ input: "Who is Jim?" }),
  // });

  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res2 = await chain.call({
    input:
      "My office is the Scranton branch of Dunder Mifflin. What about you?",
  });
  // console.log({
  //   res2,
  //   memory: await memory.loadMemoryVariables({ input: "Who is Jim?" }),
  // });

  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res3 = await chain.call({
    input: "I am Jim.",
  });
  // console.log({
  //   res3,
  //   memory: await memory.loadMemoryVariables({ input: "Who is Jim?" }),
  // });

  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res4 = await chain.call({
    input: "What have I told you about Jim so far?",
  });
  // console.log({
  //   res4,
  //   memory: await memory.loadMemoryVariables({ input: "Who is Jim?" }),
  // });
}, 120000);

test.skip("Test entity memory with a chat model in a chain", async () => {
  const memory = new EntityMemory({
    llm: new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 }),
  });
  const model = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0.9 });
  const chain = new LLMChain({
    llm: model,
    prompt: ENTITY_MEMORY_CONVERSATION_TEMPLATE,
    memory,
  });

  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res1 = await chain.call({ input: "Hi! I'm Jim." });
  // console.log({
  //   res1,
  //   memory: await memory.loadMemoryVariables({ input: "Who is Jim?" }),
  // });

  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res2 = await chain.call({
    input: "My office is the Utica branch of Dunder Mifflin. What about you?",
  });
  // console.log({
  //   res2,
  //   memory: await memory.loadMemoryVariables({ input: "Who is Jim?" }),
  // });

  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res3 = await chain.call({
    input: "I am Jim.",
  });
  // console.log({
  //   res3,
  //   memory: await memory.loadMemoryVariables({ input: "Who is Jim?" }),
  // });

  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res4 = await chain.call({
    input: "What have I told you about Jim so far?",
  });
  // console.log({
  //   res4,
  //   memory: await memory.loadMemoryVariables({ input: "Who is Jim?" }),
  // });
}, 120000);
