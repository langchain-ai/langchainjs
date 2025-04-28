import { OpenAI } from "@langchain/openai";
import { ConversationSummaryMemory } from "langchain/memory";
import { LLMChain } from "langchain/chains";
import { PromptTemplate } from "@langchain/core/prompts";

export const run = async () => {
  const memory = new ConversationSummaryMemory({
    memoryKey: "chat_history",
    llm: new OpenAI({ model: "gpt-3.5-turbo", temperature: 0 }),
  });

  const model = new OpenAI({ temperature: 0.9 });
  const prompt =
    PromptTemplate.fromTemplate(`The following is a friendly conversation between a human and an AI. The AI is talkative and provides lots of specific details from its context. If the AI does not know the answer to a question, it truthfully says it does not know.

  Current conversation:
  {chat_history}
  Human: {input}
  AI:`);
  const chain = new LLMChain({ llm: model, prompt, memory });

  const res1 = await chain.invoke({ input: "Hi! I'm Jim." });
  console.log({ res1, memory: await memory.loadMemoryVariables({}) });
  /*
  {
    res1: {
      text: " Hi Jim, I'm AI! It's nice to meet you. I'm an AI programmed to provide information about the environment around me. Do you have any specific questions about the area that I can answer for you?"
    },
    memory: {
      chat_history: 'Jim introduces himself to the AI and the AI responds, introducing itself as a program designed to provide information about the environment. The AI offers to answer any specific questions Jim may have about the area.'
    }
  }
  */

  const res2 = await chain.invoke({ input: "What's my name?" });
  console.log({ res2, memory: await memory.loadMemoryVariables({}) });
  /*
  {
    res2: { text: ' You told me your name is Jim.' },
    memory: {
      chat_history: 'Jim introduces himself to the AI and the AI responds, introducing itself as a program designed to provide information about the environment. The AI offers to answer any specific questions Jim may have about the area. Jim asks the AI what his name is, and the AI responds that Jim had previously told it his name.'
    }
  }
  */
};
