import { OpenAI } from "langchain/llms/openai";
import { PromptTemplate } from "langchain/prompts";
import { LLMChain } from "langchain/chains";

// Create a new LLMChain from a PromptTemplate and an LLM in streaming mode.
const model = new OpenAI({ temperature: 0.9, streaming: true });
const prompt = PromptTemplate.fromTemplate(
  "What is a good name for a company that makes {product}?"
);
const chain = new LLMChain({ llm: model, prompt });

// Call the chain with the inputs and a callback for the streamed tokens
const res = await chain.call({ product: "colorful socks" }, [
  {
    handleLLMNewToken(token: string) {
      process.stdout.write(token);
    },
  },
]);
console.log({ res });
// { res: { text: '\n\nKaleidoscope Socks' } }
