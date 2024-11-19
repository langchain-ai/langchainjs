import { ChatNovita } from "@langchain/community/chat_models/novita";
import { LLMChain } from "langchain/chains";
import { PromptTemplate } from "@langchain/core/prompts";


const chat = new ChatNovita({
  apiKey: "YOUR-API-KEY", // In Node.js defaults to process.env.NOVITA_API_KEY
  model: "gryphe/mythomax-l2-13b", // Check available models at https://novita.ai/llm-api
  temperature: 0.3,
});

const prompt = PromptTemplate.fromTemplate(
  "What is a good name for a company that makes {product}?"
);
const chain = new LLMChain({ llm: chat, prompt });

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
