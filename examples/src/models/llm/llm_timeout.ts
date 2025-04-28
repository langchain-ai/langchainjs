import { OpenAI } from "@langchain/openai";

const model = new OpenAI({ temperature: 1 });

const resA = await model.invoke(
  "What would be a good company name a company that makes colorful socks?",
  { timeout: 1000 } // 1s timeout
);

console.log({ resA });
// '\n\nSocktastic Colors' }
