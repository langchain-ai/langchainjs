import { OpenAI } from "@langchain/openai";

const model = new OpenAI({ temperature: 1 });
const controller = new AbortController();

// Call `controller.abort()` somewhere to cancel the request.

const res = await model.invoke(
  "What would be a good name for a company that makes colorful socks?",
  { signal: controller.signal }
);

console.log(res);
/*
'\n\nSocktastic Colors'
*/
