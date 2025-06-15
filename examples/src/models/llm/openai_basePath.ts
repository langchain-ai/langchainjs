import { OpenAI } from "@langchain/openai";

const model = new OpenAI(
  { temperature: 0 },
  { baseURL: "https://oai.hconeai.com/v1" }
);

const res = await model.invoke(
  "What would be a good company name a company that makes colorful socks?"
);
console.log(res);
