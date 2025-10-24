import { OpenAI } from "@langchain/openai";
import { BufferWindowMemory } from "langchain/memory";
import { LLMChain } from "langchain/chains";
import { PromptTemplate } from "@langchain/core/prompts";

export const run = async () => {
  const memory = new BufferWindowMemory({ memoryKey: "chat_history", k: 1 });
  const model = new OpenAI({ temperature: 0.9 });
  const template = `The following is a friendly conversation between a human and an AI. The AI is talkative and provides lots of specific details from its context. If the AI does not know the answer to a question, it truthfully says it does not know.

    Current conversation:
    {chat_history}
    Human: {input}
    AI:`;

  const prompt = PromptTemplate.fromTemplate(template);
  const chain = new LLMChain({ llm: model, prompt, memory });
  const res1 = await chain.invoke({ input: "Hi! I'm Jim." });
  console.log({ res1 });
  const res2 = await chain.invoke({ input: "What's my name?" });
  console.log({ res2 });
};
