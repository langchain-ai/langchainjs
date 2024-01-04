import { ChatOpenAI } from "langchain/chat_models/openai";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";

const model = new ChatOpenAI({});
const promptTemplate = PromptTemplate.fromTemplate(
  "Tell me a joke about {topic}"
);
const outputParser = new StringOutputParser();

const chain = RunnableSequence.from([promptTemplate, model, outputParser]);

const result = await chain.invoke({ topic: "bears" });

console.log(result);

/*
  "Why don't bears wear shoes?\n\nBecause they have bear feet!"
*/
