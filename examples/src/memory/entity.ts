import { OpenAI } from "langchain/llms/openai";
import {
  EntityMemory,
  ENTITY_MEMORY_CONVERSATION_TEMPLATE,
} from "langchain/memory";
import { LLMChain } from "langchain/chains";

export const run = async () => {
  const memory = new EntityMemory({
    llm: new OpenAI({ temperature: 0 }),
    chatHistoryKey: "history", // default value
    entitiesKey: "entities", // default value
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
    input: "I work in construction. What about you?",
  });
  console.log({
    res2,
    memory: await memory.loadMemoryVariables({ input: "Who is Jim?" }),
  });
};
