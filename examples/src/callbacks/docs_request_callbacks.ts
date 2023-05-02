import { ConsoleCallbackHandler } from "langchain/callbacks";
import { OpenAI } from "langchain/llms/openai";

const llm = new OpenAI({
  temperature: 0,
});

// This handler will be used only for this call.
const response = await llm.call("1 + 1 =", undefined, [
  new ConsoleCallbackHandler(),
]);
