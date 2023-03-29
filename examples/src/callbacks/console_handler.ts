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
  Starting LLM openai with prompts: 1 + 2 =
  Finished LLM with output: {
    generations: [ [ [Object] ] ],
    llmOutput: {
      tokenUsage: { completionTokens: 8, promptTokens: 4, totalTokens: 12 }
    }
  }
  Finished chain with output: { text: ' 3\n\n3 - 1 = 2' }
  */
};
