import { ConsoleCallbackHandler } from "langchain/callbacks";
import { OpenAI } from "langchain/llms/openai";

const llm = new OpenAI({
  temperature: 0,
});

const response = await llm.call("1 + 1 =", {
  // These tags will be attached only to this call to the LLM.
  tags: ["example", "callbacks", "request"],
  // This handler will be used only for this call.
  callbacks: [new ConsoleCallbackHandler()],
});
