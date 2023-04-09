import { OpenAI } from "langchain/llms";

export const run = async () => {
  const controller = new AbortController();

  const model = new OpenAI(
    { temperature: 1 },
    { baseOptions: { signal: controller.signal } }
  );

  // Call `controller.abort()` to cancel the request.

  const resA = await model.call(
    "What would be a good company name a company that makes colorful socks?"
  );

  console.log({ resA });
  // '\n\nSocktastic Colors' }
};
