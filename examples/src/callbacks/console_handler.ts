import { CallbackManager, ConsoleCallbackHandler } from "langchain/callbacks";
import { OpenAI, PromptTemplate, LLMChain } from "langchain";

export const run = async () => {
  const callbackManager = new CallbackManager();
  callbackManager.addHandler(new ConsoleCallbackHandler());

  const llm = new OpenAI({ temperature: 0, callbackManager });
  const prompt = PromptTemplate.fromTemplate("1 + {number} =");
  const chain = new LLMChain({ prompt, llm, callbackManager });

  await chain.call({ number: 2 });
  /*
  Entering new llm_chain chain...
  Finished chain.
  */
};
