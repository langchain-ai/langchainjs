import { OpenAI } from "@langchain/openai";
import { ConsoleCallbackHandler } from "@langchain/core/tracers/console";

const llm = new OpenAI({
  temperature: 0,
  // These tags will be attached to all calls made with this LLM.
  tags: ["example", "callbacks", "constructor"],
  // This handler will be used for all calls made with this LLM.
  callbacks: [new ConsoleCallbackHandler()],
});
