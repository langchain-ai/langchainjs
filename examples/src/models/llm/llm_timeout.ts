import { OpenAI } from "langchain/llms/openai";

export const run = async () => {
  const model = new OpenAI(
    { temperature: 1, timeout: 1000 } // 1s timeout
  );

  const resA = await model.call(
    "What would be a good company name a company that makes colorful socks?"
  );

  console.log({ resA });
  // '\n\nSocktastic Colors' }
};
