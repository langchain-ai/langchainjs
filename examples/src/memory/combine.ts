import { OpenAI } from "langchain/llms/openai";
import {
  BufferMemory,
  CombinedMemory,
  ConversationSummaryMemory,
} from "langchain/memory";
import { ConversationChain } from "langchain/chains";
import { PromptTemplate } from "langchain/prompts";

export const run = async () => {
  // buffer memory
  const conv_memory = new BufferMemory({
    memoryKey: "chat_history_lines",
    inputKey: "input",
  });

  // summary memory
  const summary_memory = new ConversationSummaryMemory({
    llm: new OpenAI({ modelName: "gpt-3.5-turbo", temperature: 0 }),
    inputKey: "input",
  });

  //
  const memory = new CombinedMemory({
    memories: [conv_memory, summary_memory],
  });

  const _DEFAULT_TEMPLATE = `The following is a friendly conversation between a human and an AI. The AI is talkative and provides lots of specific details from its context. If the AI does not know the answer to a question, it truthfully says it does not know.

Summary of conversation:
{history}
Current conversation:
{chat_history_lines}
Human: {input}
AI:`;

  const PROMPT = new PromptTemplate({
    inputVariables: ["input", "history", "chat_history_lines"],
    template: _DEFAULT_TEMPLATE,
  });
  const model = new OpenAI({ temperature: 0.9, verbose: true });
  const chain = new ConversationChain({ llm: model, memory, prompt: PROMPT });

  const res1 = await chain.call({ input: "Hi! I'm Jim." });
  console.log({ res1 });

  const res2 = await chain.call({ input: "Can you tell me a joke?" });
  console.log({ res2 });
};
