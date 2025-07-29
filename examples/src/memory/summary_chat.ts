import { ChatOpenAI } from "@langchain/openai";
import { ConversationSummaryMemory } from "langchain/memory";
import { LLMChain } from "langchain/chains";
import { PromptTemplate } from "@langchain/core/prompts";

export const run = async () => {
  const memory = new ConversationSummaryMemory({
    memoryKey: "chat_history",
    llm: new ChatOpenAI({ model: "gpt-3.5-turbo", temperature: 0 }),
  });

  const model = new ChatOpenAI({
    model: "gpt-4o-mini",
  });
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
      text: "Hello Jim! It's nice to meet you. My name is AI. How may I assist you today?"
    },
    memory: {
      chat_history: 'Jim introduces himself to the AI and the AI greets him and offers assistance.'
    }
  }
  */

  const res2 = await chain.invoke({ input: "What's my name?" });
  console.log({ res2, memory: await memory.loadMemoryVariables({}) });
  /*
  {
    res2: {
      text: "Your name is Jim. It's nice to meet you, Jim. How can I assist you today?"
    },
    memory: {
      chat_history: 'Jim introduces himself to the AI and the AI greets him and offers assistance. The AI addresses Jim by name and asks how it can assist him.'
    }
  }
  */
};
