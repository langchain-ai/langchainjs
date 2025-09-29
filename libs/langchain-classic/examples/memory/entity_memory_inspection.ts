import { OpenAI } from "@langchain/openai";
import {
  EntityMemory,
  ENTITY_MEMORY_CONVERSATION_TEMPLATE,
} from "langchain/memory";
import { LLMChain } from "langchain/chains";

const memory = new EntityMemory({
  llm: new OpenAI({ temperature: 0 }),
});
const model = new OpenAI({ temperature: 0.9 });
const chain = new LLMChain({
  llm: model,
  prompt: ENTITY_MEMORY_CONVERSATION_TEMPLATE,
  memory,
});

await chain.invoke({ input: "Hi! I'm Jim." });

await chain.invoke({
  input: "I work in sales. What about you?",
});

const res = await chain.invoke({
  input: "My office is the Utica branch of Dunder Mifflin. What about you?",
});
console.log({
  res,
  memory: await memory.loadMemoryVariables({ input: "Who is Jim?" }),
});

/*
  {
    res: "As an AI language model, I don't have an office in the traditional sense. I exist entirely in digital space and am here to assist you with any questions or tasks you may have. Is there anything specific you need help with regarding your work at the Utica branch of Dunder Mifflin?",
    memory: {
      entities: {
        Jim: 'Jim is a human named Jim who works in sales.',
        Utica: 'Utica is the location of the branch of Dunder Mifflin where Jim works.',
        'Dunder Mifflin': 'Dunder Mifflin has a branch in Utica.'
      }
    }
  }
*/
