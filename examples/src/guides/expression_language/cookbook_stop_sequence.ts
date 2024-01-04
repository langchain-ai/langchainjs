import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";

const prompt = PromptTemplate.fromTemplate(`Tell me a joke about {subject}`);

const model = new ChatOpenAI({});

const chain = prompt.pipe(model.bind({ stop: ["\n"] }));

const result = await chain.invoke({ subject: "bears" });

console.log(result);

/*
  AIMessage {
    contents: "Why don't bears use cell phones?"
  }
*/
