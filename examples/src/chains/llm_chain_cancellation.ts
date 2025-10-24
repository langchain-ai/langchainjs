import { OpenAI } from "@langchain/openai";
import { LLMChain } from "langchain/chains";
import { PromptTemplate } from "@langchain/core/prompts";

// Create a new LLMChain from a PromptTemplate and an LLM in streaming mode.
const model = new OpenAI({ temperature: 0.9, streaming: true });
const prompt = PromptTemplate.fromTemplate(
  "Give me a long paragraph about {product}?"
);
const chain = new LLMChain({ llm: model, prompt });
const controller = new AbortController();

// Call `controller.abort()` somewhere to cancel the request.
setTimeout(() => {
  controller.abort();
}, 3000);

try {
  // Call the chain with the inputs and a callback for the streamed tokens
  const res = await chain.invoke(
    { product: "colorful socks", signal: controller.signal },
    {
      callbacks: [
        {
          handleLLMNewToken(token: string) {
            process.stdout.write(token);
          },
        },
      ],
    }
  );
} catch (e) {
  console.log(e);
  // Error: Cancel: canceled
}
