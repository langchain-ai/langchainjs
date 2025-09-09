import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
});
const promptTemplate = PromptTemplate.fromTemplate(
  "Tell me a joke about {topic}"
);

const chain = promptTemplate.pipe(model);

const result = await chain.batch([{ topic: "bears" }, { topic: "cats" }]);

console.log(result);
/*
  [
    AIMessage {
      content: "Why don't bears wear shoes?\n\nBecause they have bear feet!",
    },
    AIMessage {
      content: "Why don't cats play poker in the wild?\n\nToo many cheetahs!"
    }
  ]
*/
