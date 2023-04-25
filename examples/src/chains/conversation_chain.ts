import { OpenAI } from "langchain/llms/openai";
import { ConversationChain } from "langchain/chains";

export const run = async () => {
  const model = new OpenAI({});
  const chain = new ConversationChain({ llm: model });
  const res1 = await chain.call({ input: "Hi! I'm Jim." });
  console.log({ res1 });
  const res2 = await chain.call({ input: "What's my name?" });
  console.log({ res2 });
};
