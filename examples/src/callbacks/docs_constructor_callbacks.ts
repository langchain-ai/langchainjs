import { ConsoleCallbackHandler } from "langchain/callbacks";
import { OpenAI } from "langchain/llms/openai";

const llm = new OpenAI({
  temperature: 0,
  // This handler will be used for all calls made with this LLM.
  callbacks: [new ConsoleCallbackHandler()],
});
