import { ChatOpenAI } from "@langchain/openai";
import {
  BufferMemory,
  CombinedMemory,
  ConversationSummaryMemory,
} from "langchain/memory";
import { ConversationChain } from "langchain/chains";
import { PromptTemplate } from "@langchain/core/prompts";

// buffer memory
const bufferMemory = new BufferMemory({
  memoryKey: "chat_history_lines",
  inputKey: "input",
});

// summary memory
const summaryMemory = new ConversationSummaryMemory({
  llm: new ChatOpenAI({ model: "gpt-3.5-turbo", temperature: 0 }),
  inputKey: "input",
  memoryKey: "conversation_summary",
});

//
const memory = new CombinedMemory({
  memories: [bufferMemory, summaryMemory],
});

const _DEFAULT_TEMPLATE = `The following is a friendly conversation between a human and an AI. The AI is talkative and provides lots of specific details from its context. If the AI does not know the answer to a question, it truthfully says it does not know.

Summary of conversation:
{conversation_summary}
Current conversation:
{chat_history_lines}
Human: {input}
AI:`;

const PROMPT = new PromptTemplate({
  inputVariables: ["input", "conversation_summary", "chat_history_lines"],
  template: _DEFAULT_TEMPLATE,
});
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.9,
  verbose: true,
});
const chain = new ConversationChain({ llm: model, memory, prompt: PROMPT });

const res1 = await chain.invoke({ input: "Hi! I'm Jim." });
console.log({ res1 });

/*
  {
    res1: {
      response: "Hello Jim! It's nice to meet you. How can I assist you today?"
    }
  }
*/

const res2 = await chain.invoke({ input: "Can you tell me a joke?" });
console.log({ res2 });

/*
  {
    res2: {
      response: 'Why did the scarecrow win an award? Because he was outstanding in his field!'
    }
  }
*/

const res3 = await chain.invoke({
  input: "What's my name and what joke did you just tell?",
});
console.log({ res3 });

/*
  {
    res3: {
      response: 'Your name is Jim. The joke I just told was about a scarecrow winning an award because he was outstanding in his field.'
    }
  }
*/
