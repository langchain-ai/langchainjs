import { OpenAI } from "@langchain/openai";
import { ConversationChain } from "langchain/chains";

const model = new OpenAI({});
const chain = new ConversationChain({ llm: model });
const res1 = await chain.invoke({ input: "Hi! I'm Jim." });
console.log({ res1 });
const res2 = await chain.invoke({ input: "What's my name?" });
console.log({ res2 });
