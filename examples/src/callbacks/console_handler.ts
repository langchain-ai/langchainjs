import { ConsoleCallbackHandler } from "langchain/callbacks";
import { LLMChain } from "langchain/chains";
import { OpenAI } from "langchain/llms/openai";
import { PromptTemplate } from "langchain/prompts";

export const run = async () => {
  const handler = new ConsoleCallbackHandler();
  const llm = new OpenAI({ temperature: 0, callbacks: [handler] });
  const prompt = PromptTemplate.fromTemplate("1 + {number} =");
  const chain = new LLMChain({ prompt, llm, callbacks: [handler] });

  await chain.call({ number: 2 });
  /*
  Entering new llm_chain chain...
  Finished chain.
  */
};
