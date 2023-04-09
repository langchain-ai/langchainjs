import { OpenAI } from "langchain/llms/openai";
import { PromptTemplate } from "langchain/prompts";
import { LLMChain } from "langchain/chains";
import { CallbackManager } from "langchain/callbacks";

export const run = async () => {
  const manager = CallbackManager.fromHandlers({
    async handleLLMNewToken(token: string) {
      console.log({ token });
    },
  });

  const model = new OpenAI({
    temperature: 0.9,
    streaming: true,
    callbackManager: manager,
  });

  const template = "What is a good name for a company that makes {product}?";
  const prompt = new PromptTemplate({ template, inputVariables: ["product"] });
  const chain = new LLMChain({ llm: model, prompt });
  const res = await chain.call({ product: "colorful socks" });
  console.log({ res });
};
