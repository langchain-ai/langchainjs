import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
});
const promptTemplate = PromptTemplate.fromTemplate(
  "Tell me a joke about {topic}"
);

const chain = promptTemplate.pipe(model);

const stream = await chain.stream({ topic: "bears" });

// Each chunk has the same interface as a chat message
for await (const chunk of stream) {
  console.log(chunk?.content);
}

/*
Why don't bears wear shoes?

Because they have bear feet!
*/
