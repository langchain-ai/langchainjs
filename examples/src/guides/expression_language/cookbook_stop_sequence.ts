import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";

const prompt = PromptTemplate.fromTemplate(`Tell me a joke about {subject}`);

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
});

const chain = prompt.pipe(model.withConfig({ stop: ["\n"] }));

const result = await chain.invoke({ subject: "bears" });

console.log(result);

/*
  AIMessage {
    contents: "Why don't bears use cell phones?"
  }
*/
