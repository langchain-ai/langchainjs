import { LLMChain } from "langchain/chains";
import { OpenAI } from "@langchain/openai";
import { ConsoleCallbackHandler } from "@langchain/core/tracers/console";
import { PromptTemplate } from "@langchain/core/prompts";

export const run = async () => {
  const handler = new ConsoleCallbackHandler();
  const llm = new OpenAI({ temperature: 0, callbacks: [handler] });
  const prompt = PromptTemplate.fromTemplate("1 + {number} =");
  const chain = new LLMChain({ prompt, llm, callbacks: [handler] });

  const output = await chain.invoke({ number: 2 });
  /*
  Entering new llm_chain chain...
  Finished chain.
  */

  console.log(output);
  /*
  { text: ' 3\n\n3 - 1 = 2' }
   */

  // The non-enumerable key `__run` contains the runId.
  console.log(output.__run);
  /*
  { runId: '90e1f42c-7cb4-484c-bf7a-70b73ef8e64b' }
  */
};
