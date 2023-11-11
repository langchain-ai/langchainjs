import { PromptTemplate } from "langchain/prompts";
import { ChatOpenAI } from "langchain/chat_models/openai";

const controller = new AbortController();

// Create a new LLMChain from a PromptTemplate and an LLM in streaming mode.
const llm = new ChatOpenAI({ temperature: 0.9 });
const model = llm.bind({ signal: controller.signal });
const prompt = PromptTemplate.fromTemplate(
  "Please write a 500 word essay about {topic}."
);
const chain = prompt.pipe(model);

// Call `controller.abort()` somewhere to cancel the request.
setTimeout(() => {
  controller.abort();
}, 3000);

try {
  // Call the chain with the inputs and a callback for the streamed tokens
  const stream = await chain.stream({ topic: "Bonobos" });

  for await (const chunk of stream) {
    console.log(chunk);
  }
} catch (e) {
  console.log(e);
  // Error: Cancel: canceled
}
