import { OpenAI } from "langchain/llms/openai";
import { ConversationTokenBufferMemory } from "langchain/memory";

const model = new OpenAI({});
const memory = new ConversationTokenBufferMemory({
  llm: model,
  maxTokenLimit: 10,
});

await memory.saveContext({ input: "hi" }, { output: "whats up" });
await memory.saveContext({ input: "not much you" }, { output: "not much" });

const result1 = await memory.loadMemoryVariables({});
console.log(result1);

/*
  { history: 'Human: not much you\nAI: not much' }
*/
