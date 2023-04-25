import { OpenAI } from "langchain/llms/openai";

const model = new OpenAI(
  { temperature: 0 },
  { basePath: "https://oai.hconeai.com/v1" }
);

const res = await model.call(
  "What would be a good company name a company that makes colorful socks?"
);
console.log(res);
