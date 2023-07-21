import { OpenAI } from "langchain/llms/openai";
import { ConversationSummaryBufferMemory } from "langchain/memory";
import { ConversationChain, LLMChain } from "langchain/chains";
import { ChatOpenAI } from "langchain/chat_models";

// summary buffer memory
const memory = new ConversationSummaryBufferMemory({
  llm: new ChatOpenAI({ modelName: "gpt-3.5-turbo", temperature: 0 }),
  max_token_limit: 10,
});

// await memory.saveContext({input: "hi"}, {output: "whats up"});
// await memory.saveContext({input: "not much you"}, {output: "not much"});
// const history = await memory.loadMemoryVariables({});
// console.log(JSON.stringify(history));

// const messages = await memory.chatHistory.getMessages();
// const previous_summary = "";
// const predictSummary = await memory.predictNewSummary(messages, previous_summary);
// console.log(JSON.stringify(predictSummary));

const model = new ChatOpenAI({ temperature: 0.9, verbose: true });
// const model = new OpenAI({temperature: 0.9, verbose: true});
const chain = new ConversationChain({ llm: model, memory });

const res1 = await chain.predict({ input: "Hi, what's up?" });
console.log({ res1 });

const res2 = await chain.predict({
  input: "Just working on writing some documentation!",
});
console.log({ res2 });

const res3 = await chain.predict({
  input: "For LangChain! Have you heard of it?",
});
console.log({ res3 });

const res4 = await chain.predict({
  input: "Haha nope, although a lot of people confuse it for that",
});
console.log({ res4 });
