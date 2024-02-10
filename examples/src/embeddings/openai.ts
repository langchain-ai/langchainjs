import { OpenAIEmbeddings } from "@langchain/openai";

const model = new OpenAIEmbeddings();
const res = await model.embedQuery(
  "What would be a good company name a company that makes colorful socks?"
);
console.log({ res });
