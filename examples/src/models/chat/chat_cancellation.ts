import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";

const model = new ChatOpenAI({ temperature: 1 });
const controller = new AbortController();

// Call `controller.abort()` somewhere to cancel the request.

const res = await model.invoke(
  [
    new HumanMessage(
      "What is a good name for a company that makes colorful socks?"
    ),
  ],
  { signal: controller.signal }
);

console.log(res);
/*
'\n\nSocktastic Colors'
*/
