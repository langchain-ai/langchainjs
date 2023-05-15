import { PromptTemplate } from "langchain/prompts";
import { LLMChain } from "langchain/chains";
import { OpenAI } from "langchain/llms/openai";

const chain = new LLMChain({
  llm: new OpenAI({ temperature: 0 }),
  prompt: PromptTemplate.fromTemplate("Hello, world!"),
  // This will enable logging of all Chain *and* LLM events to the console.
  verbose: true,
});
