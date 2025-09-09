import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
});
const promptTemplate = PromptTemplate.fromTemplate(
  "Tell me a joke about {topic}"
);

// You can also create a chain using an array of runnables
const chain = RunnableSequence.from([promptTemplate, model]);

const result = await chain.invoke({ topic: "bears" });

console.log(result);
/*
  AIMessage {
    content: "Why don't bears wear shoes?\n\nBecause they have bear feet!",
  }
*/
