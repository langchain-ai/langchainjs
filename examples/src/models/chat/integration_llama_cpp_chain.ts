import { ChatLlamaCpp } from "@langchain/community/chat_models/llama_cpp";
import { LLMChain } from "langchain/chains";
import { PromptTemplate } from "@langchain/core/prompts";

const llamaPath = "/Replace/with/path/to/your/model/gguf-llama2-q4_0.bin";

const model = await ChatLlamaCpp.initialize({
  modelPath: llamaPath,
  temperature: 0.5,
});

const prompt = PromptTemplate.fromTemplate(
  "What is a good name for a company that makes {product}?"
);
const chain = new LLMChain({ llm: model, prompt });

const response = await chain.invoke({ product: "colorful socks" });

console.log({ response });

/*
  {
  text: `I'm not sure what you mean by "colorful socks" but here are some ideas:\n` +
    '\n' +
    '- Sock-it to me!\n' +
    '- Socks Away\n' +
    '- Fancy Footwear'
  }
*/
